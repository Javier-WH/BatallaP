"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../config/logger.js"));
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
const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object')
        return body;
    const sanitized = Object.assign({}, body);
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
const errorHandler = (err, req, res, next) => {
    var _a, _b, _c, _d;
    const errorId = (0, uuid_1.v4)();
    // Determine status code
    let status = err.status || err.statusCode || 500;
    // Sequelize-specific error mapping
    if (err.name === 'SequelizeValidationError') {
        status = 400;
    }
    else if (err.name === 'SequelizeUniqueConstraintError') {
        status = 409;
    }
    else if (err.name === 'SequelizeForeignKeyConstraintError') {
        status = 409;
    }
    // Build the log metadata
    const userId = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.user) === null || _b === void 0 ? void 0 : _b.id;
    const userRoles = (_d = (_c = req.session) === null || _c === void 0 ? void 0 : _c.user) === null || _d === void 0 ? void 0 : _d.roles;
    const logMeta = {
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
        logger_1.default.error('Unhandled server error', logMeta);
    }
    else if (status >= 400) {
        logger_1.default.warn('Client error', logMeta);
    }
    else {
        logger_1.default.info('Error handler invoked', logMeta);
    }
    // Send response to client
    const response = {
        message: status >= 500
            ? 'Error interno del servidor'
            : err.message || 'Error en la petición',
        errorId,
    };
    // Include validation details for Sequelize validation errors
    if (err.name === 'SequelizeValidationError' && err.errors) {
        response.message = 'Error de validación';
        response.errors = err.errors.map((e) => ({
            field: e.path,
            message: e.message,
            value: e.value,
        }));
    }
    if (err.name === 'SequelizeUniqueConstraintError' && err.errors) {
        response.message = 'Registro duplicado';
        response.errors = err.errors.map((e) => ({
            field: e.path,
            message: e.message,
        }));
    }
    res.status(status).json(response);
};
exports.errorHandler = errorHandler;
/**
 * 404 handler for unmatched API routes.
 * Logs as a warning so we can detect misconfigured routes or probing.
 */
const notFoundHandler = (req, res) => {
    logger_1.default.warn('Route not found', {
        method: req.method,
        url: req.originalUrl || req.url,
        ip: req.ip,
    });
    res.status(404).json({ message: 'Ruta no encontrada' });
};
exports.notFoundHandler = notFoundHandler;
exports.default = exports.errorHandler;
