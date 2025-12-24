import { Request, Response } from 'express';
import { GuardianDocumentType } from '@/models/GuardianProfile';
import { findGuardianProfile, findOrCreateGuardianProfile } from '@/services/guardianProfileService';

export const searchGuardian = async (req: Request, res: Response) => {
  try {
    const { documentType, document, createIfMissing } = req.query;

    if (!documentType || !document) {
      return res.status(400).json({ error: 'documentType y document son obligatorios' });
    }

    const normalizedDoc = (document as string).trim();
    const typeValue = documentType as GuardianDocumentType;

    const profile = await findGuardianProfile(typeValue, normalizedDoc);

    if (profile) {
      return res.json(profile);
    }

    if (createIfMissing === 'true') {
      const { firstName, lastName, phone, email, residenceState, residenceMunicipality, residenceParish, address } = req.body || {};
      if (!firstName || !lastName || !phone || !email || !residenceState || !residenceMunicipality || !residenceParish || !address) {
        return res.status(400).json({ error: 'Datos insuficientes para crear un representante' });
      }

      const created = await findOrCreateGuardianProfile({
        firstName,
        lastName,
        document: normalizedDoc,
        documentType: typeValue,
        phone,
        email,
        residenceState,
        residenceMunicipality,
        residenceParish,
        address
      });

      return res.status(201).json(created);
    }

    return res.status(404).json({ error: 'Representante no encontrado' });
  } catch (error) {
    console.error('Error searching guardian:', error);
    return res.status(500).json({ error: 'Error buscando representante' });
  }
};
