import { useState, useCallback } from 'react';
import { searchGuardian } from '@/services/guardians';
import type { GuardianDocumentType, GuardianProfileResponse } from '@/services/guardians';

export type GuardianLookupState = GuardianProfileResponse | null;

export const useGuardianLookup = () => {
  const [loadingGuardian, setLoadingGuardian] = useState(false);
  const [lastLookupKey, setLastLookupKey] = useState<string>('');

  const lookupGuardian = useCallback(async (documentType?: GuardianDocumentType, document?: string) => {
    if (!documentType || !document?.trim()) {
      setLastLookupKey('');
      return null;
    }

    const key = `${documentType}-${document.trim()}`;
    if (key === lastLookupKey) {
      return null;
    }

    setLoadingGuardian(true);
    try {
      const profile = await searchGuardian(documentType, document.trim());
      setLastLookupKey(key);
      return profile;
    } finally {
      setLoadingGuardian(false);
    }
  }, [lastLookupKey]);

  const resetGuardianLookup = useCallback(() => {
    setLastLookupKey('');
  }, []);

  return {
    loadingGuardian,
    lookupGuardian,
    resetGuardianLookup
  };
};
