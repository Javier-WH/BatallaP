import { Request, Response } from 'express';
import { Bank } from '@/models';

/**
 * GET /api/banks?active=1
 * Lists the bank catalog (Sudeban codes + icons). Any authenticated user can
 * read it — the payment modal consumes it for the bank select.
 */
export const listBanks = async (req: Request, res: Response) => {
  try {
    const where: any = {};
    if (req.query.active === '1' || req.query.active === 'true') where.active = true;
    const banks = await Bank.findAll({
      where,
      order: [['shortName', 'ASC']],
    });
    return res.json(banks);
  } catch (error) {
    console.error('[listBanks] Error:', error);
    return res.status(500).json({ message: 'Error al listar bancos' });
  }
};

const validateBankPayload = (body: any): string | null => {
  const code = String(body.code ?? '').trim();
  if (!/^\d{4}$/.test(code)) return 'El código debe tener exactamente 4 dígitos';
  if (!String(body.name ?? '').trim()) return 'El nombre es obligatorio';
  if (!String(body.shortName ?? '').trim()) return 'El nombre corto es obligatorio';
  return null;
};

/**
 * POST /api/banks (multipart, optional `icon` image)
 * Creates a custom bank entry (Master/Administrador only, via route guard).
 */
export const createBank = async (req: Request, res: Response) => {
  try {
    const payloadError = validateBankPayload(req.body);
    if (payloadError) return res.status(400).json({ message: payloadError });

    const code = String(req.body.code).trim();
    const exists = await Bank.findOne({ where: { code } });
    if (exists) return res.status(409).json({ message: 'Ya existe un banco con ese código' });

    const bank = await Bank.create({
      code,
      name: String(req.body.name).trim(),
      shortName: String(req.body.shortName).trim(),
      rif: req.body.rif ? String(req.body.rif).trim() : null,
      icon: req.file ? `/uploads/banks/${req.file.filename}` : null,
      active: req.body.active === undefined ? true : req.body.active === 'true' || req.body.active === true,
    });
    return res.status(201).json(bank);
  } catch (error) {
    console.error('[createBank] Error:', error);
    return res.status(500).json({ message: 'Error al crear el banco' });
  }
};

/**
 * PUT /api/banks/:id (multipart, optional `icon` image)
 * Updates a bank entry; also used to toggle `active`.
 */
export const updateBank = async (req: Request, res: Response) => {
  try {
    const bank = await Bank.findByPk(Number(req.params.id));
    if (!bank) return res.status(404).json({ message: 'Banco no encontrado' });

    const hasField = (k: string) => req.body[k] !== undefined;
    if (hasField('code') || hasField('name') || hasField('shortName')) {
      const merged = { code: bank.code, name: bank.name, shortName: bank.shortName, ...req.body };
      const payloadError = validateBankPayload(merged);
      if (payloadError) return res.status(400).json({ message: payloadError });
    }
    if (hasField('code')) {
      const code = String(req.body.code).trim();
      const dup = await Bank.findOne({ where: { code } });
      if (dup && dup.id !== bank.id) return res.status(409).json({ message: 'Ya existe un banco con ese código' });
      bank.code = code;
    }
    if (hasField('name')) bank.name = String(req.body.name).trim();
    if (hasField('shortName')) bank.shortName = String(req.body.shortName).trim();
    if (hasField('rif')) bank.rif = req.body.rif ? String(req.body.rif).trim() : null;
    if (hasField('active')) bank.active = req.body.active === 'true' || req.body.active === true;
    if (req.file) bank.icon = `/uploads/banks/${req.file.filename}`;

    await bank.save();
    return res.json(bank);
  } catch (error) {
    console.error('[updateBank] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar el banco' });
  }
};
