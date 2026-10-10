import { Inscription } from '@/models';
import { renumberSectionRoster, renumberRosters } from '@/services/rosterNumberService';
import { createAcademicStructure, createTestInscription, createTestUser } from '../helpers/testData';

async function makeStudent(structure: any, document: string, lastName = 'Apellido', firstName = 'Nombre') {
  const { person } = await createTestUser({ document, documentType: 'Venezolano', lastName, firstName });
  return createTestInscription(person.id, structure.period.id, structure.grade.id, structure.section.id);
}

const numbers = async () =>
  (await Inscription.findAll({ order: [['id', 'ASC']] }) as any[]).map(i => ({
    id: i.id, rosterNumber: i.rosterNumber, withdrawnAt: i.withdrawnAt,
  }));

describe('rosterNumberService', () => {
  it('asigna números 1..N siguiendo el orden canónico (cédula ascendente)', async () => {
    const structure = await createAcademicStructure();
    const a = await makeStudent(structure, '300');
    const b = await makeStudent(structure, '100');
    const c = await makeStudent(structure, '200');

    await renumberSectionRoster(structure.period.id, structure.grade.id, structure.section.id);

    const map = new Map((await numbers()).map(r => [r.id, r.rosterNumber]));
    expect(map.get(b.id)).toBe(1);
    expect(map.get(c.id)).toBe(2);
    expect(map.get(a.id)).toBe(3);
  });

  it('al retirar un estudiante, su número queda NULL y los demás renumeran', async () => {
    const structure = await createAcademicStructure();
    const a = await makeStudent(structure, '300');
    const b = await makeStudent(structure, '100');
    const c = await makeStudent(structure, '200');

    await renumberSectionRoster(structure.period.id, structure.grade.id, structure.section.id);

    // Emula el flujo real: la instancia se recarga fresca antes de retirar.
    await b.reload();
    await b.update({ withdrawnAt: new Date(), sectionId: null, rosterNumber: null } as any);
    await renumberSectionRoster(structure.period.id, structure.grade.id, structure.section.id);

    const map = new Map((await numbers()).map(r => [r.id, r]));
    expect(map.get(b.id)!.rosterNumber).toBeNull();
    expect(map.get(c.id)!.rosterNumber).toBe(1);
    expect(map.get(a.id)!.rosterNumber).toBe(2);
  });

  it('un estudiante nuevo toma la posición que le corresponde en el orden', async () => {
    const structure = await createAcademicStructure();
    const a = await makeStudent(structure, '300');
    const b = await makeStudent(structure, '100');
    await renumberSectionRoster(structure.period.id, structure.grade.id, structure.section.id);

    const c = await makeStudent(structure, '200');
    await renumberSectionRoster(structure.period.id, structure.grade.id, structure.section.id);

    const map = new Map((await numbers()).map(r => [r.id, r.rosterNumber]));
    expect(map.get(b.id)).toBe(1);
    expect(map.get(c.id)).toBe(2);
    expect(map.get(a.id)).toBe(3);
  });

  it('renumberRosters deduplica scopes y omite sectionId null', async () => {
    const structure = await createAcademicStructure();
    await makeStudent(structure, '100');
    await expect(renumberRosters([
      { schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id },
      { schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: structure.section.id },
      { schoolPeriodId: structure.period.id, gradeId: structure.grade.id, sectionId: null },
    ])).resolves.toBeUndefined();

    const map = (await numbers()).map(r => r.rosterNumber);
    expect(map).toEqual([1]);
  });
});
