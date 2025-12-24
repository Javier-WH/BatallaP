import GuardianProfile, { GuardianDocumentType } from '@/models/GuardianProfile';
import { Transaction } from 'sequelize';

export type GuardianProfilePayload = {
  firstName: string;
  lastName: string;
  documentType: GuardianDocumentType;
  document: string;
  phone: string;
  email: string;
  residenceState: string;
  residenceMunicipality: string;
  residenceParish: string;
  address: string;
};

interface Options {
  transaction?: Transaction;
}

const normalizeDocument = (document: string) => document.trim();

export const findGuardianProfile = async (documentType: GuardianDocumentType, document: string) => {
  return GuardianProfile.findOne({
    where: {
      documentType,
      document: normalizeDocument(document)
    }
  });
};

export const findOrCreateGuardianProfile = async (
  payload: GuardianProfilePayload,
  options: Options = {}
): Promise<GuardianProfile> => {
  const normalizedDocument = normalizeDocument(payload.document);

  const [profile, created] = await GuardianProfile.findOrCreate({
    where: {
      documentType: payload.documentType,
      document: normalizedDocument
    },
    defaults: {
      ...payload,
      document: normalizedDocument
    },
    ...options
  });

  if (!created) {
    await profile.update(
      {
        ...payload,
        document: normalizedDocument
      },
      options
    );
  }

  return profile;
};
