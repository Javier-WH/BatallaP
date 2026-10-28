import { Request, Response } from 'express';
import { verifyBankPayment } from '@/services/bankVerificationService';

/**
 * POST /api/bank-verification/verify
 * Body: { bankCode?, last4, cedula, date? }
 * Only Master may query the school's bank account.
 */
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const roles: string[] = (req.session as any)?.user?.roles ?? [];
    if (!roles.includes('Master')) {
      return res.status(403).json({ message: 'Solo el usuario Master puede verificar pagos' });
    }
    const { bankCode, last4, cedula, date } = req.body ?? {};
    if (!last4 || !/^\d{4}$/.test(String(last4))) {
      return res.status(400).json({ message: 'Indique los últimos 4 dígitos de la referencia' });
    }
    if (!cedula || !/^\d{6,9}$/.test(String(cedula).replace(/\D/g, ''))) {
      return res.status(400).json({ message: 'Indique la cédula del pagador' });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({ message: 'Fecha inválida' });
    }
    const result = await verifyBankPayment({
      bankCode: bankCode ? String(bankCode) : undefined,
      last4: String(last4),
      cedula: String(cedula),
      date: date ? String(date) : undefined,
    });
    return res.json(result);
  } catch (error: any) {
    console.error('[verifyPayment] Error:', error);
    return res.status(500).json({ message: 'Error al verificar el pago' });
  }
};
