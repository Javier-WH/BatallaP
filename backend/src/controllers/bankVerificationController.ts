import { Request, Response } from 'express';
import { BankConnection } from '@/models';
import { verifyBankPayment, BANK_PROVIDERS } from '@/services/bankVerificationService';

const isMaster = (req: Request) => ((req.session as any)?.user?.roles ?? []).includes('Master');

/** Public shape — credentials never leave the server. */
const publicConnection = (c: BankConnection) => ({
  id: c.id,
  provider: c.provider,
  accountType: c.accountType,
  label: c.label,
  username: c.username,
  hasPassword: !!c.password,
  active: c.active,
});

/** GET /api/bank-verification/providers — banks we have a verification flow for. */
export const listProviders = async (req: Request, res: Response) => {
  if (!isMaster(req)) return res.status(403).json({ message: 'Solo el usuario Master' });
  return res.json(BANK_PROVIDERS);
};

/** GET /api/bank-verification/connections — configured receiving accounts. */
export const listConnections = async (req: Request, res: Response) => {
  if (!isMaster(req)) return res.status(403).json({ message: 'Solo el usuario Master' });
  const rows = await BankConnection.findAll({ order: [['id', 'ASC']] });
  return res.json(rows.map(publicConnection));
};

/** POST /api/bank-verification/connections */
export const createConnection = async (req: Request, res: Response) => {
  if (!isMaster(req)) return res.status(403).json({ message: 'Solo el usuario Master' });
  const { provider, label, username, password } = req.body ?? {};
  const prov = BANK_PROVIDERS.find(p => p.key === provider);
  if (!prov) return res.status(400).json({ message: 'Proveedor de banco no soportado' });
  if (!label?.trim()) return res.status(400).json({ message: 'Indique un nombre para la conexión' });
  if (prov.accountType === 'natural' && (!username?.trim() || !password)) {
    return res.status(400).json({ message: 'Las cuentas naturales requieren usuario y contraseña' });
  }
  const created = await BankConnection.create({
    provider: prov.key,
    accountType: prov.accountType,
    label: label.trim(),
    username: username?.trim() || null,
    password: password || null,
  });
  return res.status(201).json(publicConnection(created));
};

/** PUT /api/bank-verification/connections/:id */
export const updateConnection = async (req: Request, res: Response) => {
  if (!isMaster(req)) return res.status(403).json({ message: 'Solo el usuario Master' });
  const conn = await BankConnection.findByPk(Number(req.params.id));
  if (!conn) return res.status(404).json({ message: 'Conexión no encontrada' });
  const { label, username, password, active } = req.body ?? {};
  await conn.update({
    label: label != null ? String(label).trim() : conn.label,
    username: username != null ? String(username).trim() : conn.username,
    // Empty password keeps the stored one.
    password: password ? String(password) : conn.password,
    active: active != null ? !!active : conn.active,
  });
  return res.json(publicConnection(conn));
};

/** DELETE /api/bank-verification/connections/:id */
export const deleteConnection = async (req: Request, res: Response) => {
  if (!isMaster(req)) return res.status(403).json({ message: 'Solo el usuario Master' });
  await BankConnection.destroy({ where: { id: Number(req.params.id) } });
  return res.json({ message: 'Conexión eliminada' });
};

/**
 * POST /api/bank-verification/verify
 * Body: { connectionId, bankCode?, last4, cedula, date? }
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    if (!isMaster(req)) {
      return res.status(403).json({ message: 'Solo el usuario Master puede verificar pagos' });
    }
    const { connectionId, bankCode, last4, cedula, date } = req.body ?? {};
    if (!connectionId) return res.status(400).json({ message: 'Seleccione el banco receptor' });
    if (!last4 || !/^\d{4}$/.test(String(last4))) {
      return res.status(400).json({ message: 'Indique los últimos 4 dígitos de la referencia' });
    }
    if (!cedula || !/^\d{6,9}$/.test(String(cedula).replace(/\D/g, ''))) {
      return res.status(400).json({ message: 'Indique la cédula del pagador' });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Fecha inválida' });
    }

    const conn = await BankConnection.findByPk(Number(connectionId));
    if (!conn || !conn.active) {
      return res.status(400).json({ message: 'La conexión bancaria no existe o está inactiva' });
    }
    if (conn.provider !== 'bvc_natural') {
      return res.status(400).json({ message: 'Este proveedor aún no tiene flujo de verificación' });
    }
    if (!conn.username || !conn.password) {
      return res.status(400).json({ message: 'La conexión no tiene credenciales configuradas' });
    }

    const result = await verifyBankPayment(
      {
        bankCode: bankCode ? String(bankCode) : undefined,
        last4: String(last4),
        cedula: String(cedula),
        date: date ? String(date) : undefined,
      },
      { user: conn.username, pass: conn.password },
    );
    return res.json(result);
  } catch (error: any) {
    console.error('[verifyPayment] Error:', error);
    return res.status(500).json({ message: 'Error al verificar el pago' });
  }
};
