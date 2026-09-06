import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from '@/config/logger';

// Fields to redact from logged request bodies
const SENSITIVE_FIELDS = [
  'password',
  'passwordConfirm',
  'sessionSecret',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'authorization',
];

const sanitizeBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;
  const sanitized: any = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  return sanitized;
};

/**
 * Global Express error handler (4-arity middleware).
 * Captures any error that reaches next(error), logs it with full context,
 * and responds to the client with a JSON error containing an errorId
 * that can be used to locate the error in the log files.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  const errorId = uuidv4();

  // Determine status code
  let status = err.status || err.statusCode || 500;

  // Sequelize-specific error mapping
  if (err.name === 'SequelizeValidationError') {
    status = 400;
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    status = 409;
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    status = 409;
  }

  // Build the log metadata
  const userId = (req.session as any)?.user?.id;
  const userRoles = (req.session as any)?.user?.roles;

  const logMeta: Record<string, any> = {
    errorId,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    status,
    userId: userId || null,
    userRoles: userRoles || null,
    errorName: err.name || 'Error',
    errorMessage: err.message,
    stack: err.stack,
    body: sanitizeBody(req.body),
    query: req.query,
    params: req.params,
  };

  // Log at appropriate level based on status code
  if (status >= 500) {
    logger.error('Unhandled server error', logMeta);
  } else if (status >= 400) {
    logger.warn('Client error', logMeta);
  } else {
    logger.info('Error handler invoked', logMeta);
  }

  // Send response to client
  const response: any = {
    message: status >= 500
      ? 'Error interno del servidor'
      : err.message || 'Error en la petición',
    errorId,
  };

  // Include validation details for Sequelize validation errors
  if (err.name === 'SequelizeValidationError' && err.errors) {
    response.message = 'Error de validación';
    response.errors = err.errors.map((e: any) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }

  if (err.name === 'SequelizeUniqueConstraintError' && err.errors) {
    response.message = 'Registro duplicado';
    response.errors = err.errors.map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
  }

  res.status(status).json(response);
};

/**
 * 404 handler for unmatched API routes.
 * Logs as a warning so we can detect misconfigured routes or probing.
 */
export const notFoundHandler = (req: Request, res: Response): void => {
  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
  });
  res.status(404).json({ message: 'Ruta no encontrada' });
};

export default errorHandler;
