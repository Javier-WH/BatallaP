import { Transaction } from 'sequelize';
import PeriodGrade from '@/models/PeriodGrade';
import PeriodGradeSubject from '@/models/PeriodGradeSubject';

/**
 * subjectOrderService
 *
 * Fuente única para resolver el orden canónico de materias en cualquier
 * listado (UI, exportes, PDFs). El orden vive en `PeriodGradeSubject.order`,
 * scoped por `(periodGradeId = schoolPeriodId + gradeId)`.
 *
 * Reglas:
 * - Ordenar por `PeriodGradeSubject.order` ASC.
 * - Cuando `order` sea NULL o la materia no esté en el `PeriodGrade` del
 *   contexto, usar fallback alfabético por `subject.name` (nulls al final).
 * - Cualquier nueva consulta que retorne materias en lote debe usar este
 *   helper antes de enviar la respuesta.
 */

export type SubjectOrderMap = Map<number, number>;
export type SubjectIncludeInAverageMap = Map<number, boolean>;

/**
 * Devuelve un Map<subjectId, order> para un PeriodGrade.
 * Si no existe, devuelve un Map vacío (callers aplicarán fallback alfabético).
 */
export async function getSubjectOrderMap(
  periodGradeId: number | null | undefined,
  transaction?: Transaction
): Promise<SubjectOrderMap> {
  const map: SubjectOrderMap = new Map();
  if (!periodGradeId) return map;

  const rows = await PeriodGradeSubject.findAll({
    where: { periodGradeId },
    attributes: ['subjectId', 'order'],
    transaction,
  });

  rows.forEach((pgs) => {
    if (pgs.order !== null && pgs.order !== undefined) {
      map.set(pgs.subjectId, pgs.order);
    }
  });

  return map;
}

/**
 * Devuelve un Map<subjectId, includeInAverage> para un PeriodGrade.
 * Materias no presentes en el mapa se asumen como includeInAverage = true.
 */
export async function getSubjectIncludeInAverageMap(
  periodGradeId: number | null | undefined,
  transaction?: Transaction
): Promise<SubjectIncludeInAverageMap> {
  const map: SubjectIncludeInAverageMap = new Map();
  if (!periodGradeId) return map;

  const rows = await PeriodGradeSubject.findAll({
    where: { periodGradeId },
    attributes: ['subjectId', 'includeInAverage'],
    transaction,
  });

  rows.forEach((pgs) => {
    map.set(pgs.subjectId, pgs.includeInAverage);
  });

  return map;
}

/**
 * Resuelve el PeriodGrade a partir de gradeId + schoolPeriodId y devuelve
 * el mapa de orden de sus materias.
 */
export async function getSubjectOrderMapByGradeAndPeriod(
  gradeId: number | null | undefined,
  schoolPeriodId: number | null | undefined,
  transaction?: Transaction
): Promise<SubjectOrderMap> {
  if (!gradeId || !schoolPeriodId) return new Map();

  const pg = await PeriodGrade.findOne({
    where: { gradeId, schoolPeriodId },
    attributes: ['id'],
    transaction,
  });

  if (!pg) return new Map();
  return getSubjectOrderMap(pg.id, transaction);
}

/**
 * Resuelve el PeriodGrade a partir de gradeId + schoolPeriodId y devuelve
 * el mapa de includeInAverage de sus materias.
 */
export async function getSubjectIncludeInAverageMapByGradeAndPeriod(
  gradeId: number | null | undefined,
  schoolPeriodId: number | null | undefined,
  transaction?: Transaction
): Promise<SubjectIncludeInAverageMap> {
  if (!gradeId || !schoolPeriodId) return new Map();

  const pg = await PeriodGrade.findOne({
    where: { gradeId, schoolPeriodId },
    attributes: ['id'],
    transaction,
  });

  if (!pg) return new Map();
  return getSubjectIncludeInAverageMap(pg.id, transaction);
}

/**
 * Ordena in-place / devuelve una nueva lista ordenada según el orderMap,
 * con fallback alfabético por nombre de materia.
 *
 * @param items  Elementos que contienen un subjectId y opcionalmente un nombre
 * @param getSubjectId  Selector que devuelve el subjectId de cada item
 * @param getSubjectName  Selector opcional para fallback alfabético
 * @param orderMap  Mapa proveniente de getSubjectOrderMap(...)
 */
export function sortSubjectsByOrder<T>(
  items: T[],
  getSubjectId: (item: T) => number | null | undefined,
  getSubjectName: ((item: T) => string | null | undefined) | null,
  orderMap: SubjectOrderMap
): T[] {
  const FALLBACK = Number.MAX_SAFE_INTEGER;

  return [...items].sort((a, b) => {
    const idA = getSubjectId(a);
    const idB = getSubjectId(b);

    const orderA = (idA != null && orderMap.get(idA) != null) ? (orderMap.get(idA) as number) : FALLBACK;
    const orderB = (idB != null && orderMap.get(idB) != null) ? (orderMap.get(idB) as number) : FALLBACK;

    if (orderA !== orderB) return orderA - orderB;

    // Fallback alfabético cuando ambos carecen de orden o empatan
    if (getSubjectName) {
      const nameA = (getSubjectName(a) ?? '').toString();
      const nameB = (getSubjectName(b) ?? '').toString();
      return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
    }

    return 0;
  });
}

/**
 * Utilidad: separa items en [regulares, pendientes] y retorna una lista donde
 * las pendientes van al final (ordenadas internamente por nombre).
 * Los regulares conservan el orden canónico del orderMap.
 */
export function sortSubjectsWithPendingAtEnd<T>(
  items: T[],
  getSubjectId: (item: T) => number | null | undefined,
  getSubjectName: ((item: T) => string | null | undefined) | null,
  isPending: (item: T) => boolean,
  orderMap: SubjectOrderMap
): T[] {
  const regular: T[] = [];
  const pending: T[] = [];
  items.forEach((it) => (isPending(it) ? pending.push(it) : regular.push(it)));

  const sortedRegular = sortSubjectsByOrder(regular, getSubjectId, getSubjectName, orderMap);
  const sortedPending = getSubjectName
    ? [...pending].sort((a, b) =>
        (getSubjectName(a) ?? '').toString().localeCompare(
          (getSubjectName(b) ?? '').toString(),
          'es',
          { sensitivity: 'base' }
        )
      )
    : pending;

  return [...sortedRegular, ...sortedPending];
}
