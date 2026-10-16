import { Request, Response, NextFunction } from 'express';

const PAYMENTS_ROLES = ['Master', 'Administrador'];

/** Requires an authenticated session (any role). */
export const requireSession = (req: Request, res: Response, next: NextFunction) => {
  if (!(req.session as any)?.user) return res.status(401).json({ message: 'No autenticado' });
  next();
};

/**
 * Guards the payments module (ledger + costs config): requires an
 * authenticated session and a Master/Administrador role.
 */
export const requirePaymentsAccess = (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).json({ message: 'No autenticado' });
  const roles: string[] = user.roles ?? [];
  if (!roles.some(r => PAYMENTS_ROLES.includes(r))) {
    return res.status(403).json({ message: 'No tienes permisos para acceder al módulo de pagos' });
  }
  next();
};

const DEBT_VIEW_ROLES = [...PAYMENTS_ROLES, 'Control de Estudios'];

/**
 * Debt summary + document-hold release of one inscription. Control de Estudios
 * needs it for the withdrawal flow (they decide what happens with the debt and
 * whether the student's documents stay held).
 */
export const requireDebtView = (req: Request, res: Response, next: NextFunction) => {
  const user = (req.session as any)?.user;
  if (!user) return res.status(401).json({ message: 'No autenticado' });
  const roles: string[] = user.roles ?? [];
  if (!roles.some(r => DEBT_VIEW_ROLES.includes(r))) {
    return res.status(403).json({ message: 'No tienes permisos para consultar la deuda' });
  }
  next();
};
