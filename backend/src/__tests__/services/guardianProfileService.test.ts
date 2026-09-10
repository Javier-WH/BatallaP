import {
  findGuardianProfile,
  findOrCreateGuardianProfile,
} from '@/services/guardianProfileService';
import {
  GuardianProfile,
  Person,
  Role,
  Contact,
  PersonRole,
} from '@/models/index';
import {
  createTestUser,
  createTestRole,
} from '../helpers/testData';

describe('guardianProfileService', () => {
  describe('findGuardianProfile', () => {
    it('retorna un GuardianProfile existente', async () => {
      const gp = await GuardianProfile.create({
        firstName: 'María',
        lastName: 'Pérez',
        documentType: 'Venezolano',
        document: '12345678',
        phone: '0414-1234567',
        email: 'maria@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Calle 123',
      });

      const result = await findGuardianProfile('Venezolano', '12345678');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(gp.id);
      expect(result!.firstName).toBe('MARÍA'); // hook mayusculiza
    });

    it('normaliza el document con trim', async () => {
      await GuardianProfile.create({
        firstName: 'María',
        lastName: 'Pérez',
        documentType: 'Venezolano',
        document: '12345678',
        phone: '0414-1234567',
        email: 'maria@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Calle 123',
      });

      const result = await findGuardianProfile('Venezolano', '  12345678  ');
      expect(result).not.toBeNull();
    });

    it('mapea desde Person cuando no está en GuardianProfile y no es Alumno', async () => {
      const { person } = await createTestUser({
        username: 'guardian1',
        firstName: 'Carlos',
        lastName: 'López',
        document: '87654321',
        documentType: 'Venezolano',
      });
      const repRole = await createTestRole('Representante');
      await PersonRole.create({ personId: person.id, roleId: repRole.id });
      await Contact.create({
        personId: person.id,
        phone1: '0412-9876543',
        email: 'carlos@test.com',
        address: 'Av Principal',
      });

      const result = await findGuardianProfile('Venezolano', '87654321');
      expect(result).not.toBeNull();
      expect(result!.firstName).toBe('CARLOS');
      expect(result!.lastName).toBe('LÓPEZ');
    });

    it('retorna null cuando la Person solo tiene rol Alumno', async () => {
      const { person } = await createTestUser({
        username: 'student1',
        firstName: 'Niño',
        lastName: 'Estudiante',
        document: '11111111',
        documentType: 'Venezolano',
      });
      const alumnoRole = await createTestRole('Alumno');
      await PersonRole.create({ personId: person.id, roleId: alumnoRole.id });

      const result = await findGuardianProfile('Venezolano', '11111111');
      expect(result).toBeNull();
    });

    it('retorna null cuando no existe en ninguna tabla', async () => {
      const result = await findGuardianProfile('Venezolano', '99999999');
      expect(result).toBeNull();
    });
  });

  describe('findOrCreateGuardianProfile', () => {
    it('crea un nuevo GuardianProfile si no existe', async () => {
      const payload = {
        firstName: 'Ana',
        lastName: 'García',
        documentType: 'Venezolano' as const,
        document: '22222333',
        phone: '0414-1111111',
        email: 'ana@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Calle 456',
      };

      const profile = await findOrCreateGuardianProfile(payload);
      expect(profile).toBeDefined();
      expect(profile.firstName).toBe('ANA');
      expect(profile.document).toBe('22222333');

      const count = await GuardianProfile.count({ where: { document: '22222333' } });
      expect(count).toBe(1);
    });

    it('retorna y actualiza el existente sin duplicar', async () => {
      await GuardianProfile.create({
        firstName: 'Old Name',
        lastName: 'Old Last',
        documentType: 'Venezolano',
        document: '33333444',
        phone: '0414-2222222',
        email: 'old@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Old Address',
      });

      const payload = {
        firstName: 'New Name',
        lastName: 'New Last',
        documentType: 'Venezolano' as const,
        document: '33333444',
        phone: '0414-3333333',
        email: 'new@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'New Address',
      };

      const profile = await findOrCreateGuardianProfile(payload);
      expect(profile.firstName).toBe('NEW NAME');

      const count = await GuardianProfile.count({ where: { document: '33333444' } });
      expect(count).toBe(1);
    });

    it('normaliza el document con trim', async () => {
      const payload = {
        firstName: 'Test',
        lastName: 'Trim',
        documentType: 'Venezolano' as const,
        document: '  44444555  ',
        phone: '0414-4444444',
        email: 'trim@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Trim Address',
      };

      const profile = await findOrCreateGuardianProfile(payload);
      expect(profile.document).toBe('44444555');
    });

    it('actualiza por ID cuando se provee y existe', async () => {
      const existing = await GuardianProfile.create({
        firstName: 'Original',
        lastName: 'Profile',
        documentType: 'Venezolano',
        document: '55555666',
        phone: '0414-5555555',
        email: 'orig@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Orig Address',
      });

      const payload = {
        id: existing.id,
        firstName: 'Updated',
        lastName: 'Profile',
        documentType: 'Venezolano' as const,
        document: '55555666',
        phone: '0414-6666666',
        email: 'updated@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Updated Address',
      };

      const profile = await findOrCreateGuardianProfile(payload);
      expect(profile.firstName).toBe('UPDATED');
      expect(profile.id).toBe(existing.id);
    });

    it('cae a findOrCreate cuando el ID no existe', async () => {
      const payload = {
        id: 99999,
        firstName: 'Fallback',
        lastName: 'Profile',
        documentType: 'Venezolano' as const,
        document: '77777888',
        phone: '0414-7777777',
        email: 'fallback@test.com',
        residenceState: 'Guárico',
        residenceMunicipality: 'Monagas',
        residenceParish: 'Altagracia de Orituco',
        address: 'Fallback Address',
      };

      const profile = await findOrCreateGuardianProfile(payload);
      expect(profile).toBeDefined();
      expect(profile.firstName).toBe('FALLBACK');
    });
  });
});
