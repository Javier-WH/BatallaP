/**
 * studentSortService
 *
 * Fuente única para el orden canónico de estudiantes en cualquier listado
 * (nómina, consejos de curso, boletines, actas, plantillas, performanceSummary,
 * exportes Excel/PDF, etc.).
 *
 * Reglas de ordenamiento (de menor a mayor prioridad):
 *  1. Tipo de documento: Venezolano → Cédula Escolar → Pasaporte → Extranjero.
 *  2. Número de cédula ascendente (numérico).
 *  3. Apellido (lexicográfico, case-insensitive).
 *  4. Nombre (lexicográfico, case-insensitive).
 *  5. Año / grado (ascendente por `grade.order`, fallback `grade.name`).
 *  6. Sección (ascendente por `section.name`).
 *
 * Cualquier nueva consulta que retorne estudiantes en lote debe usar este
 * helper antes de enviar la respuesta.
 */

export type StudentDocumentType =
  | 'Venezolano'
  | 'Cedula Escolar'
  | 'Pasaporte'
  | 'Extranjero';

/** Prioridad de tipo de documento (menor = aparece primero). */
const DOCUMENT_TYPE_PRIORITY: Record<string, number> = {
  Venezolano: 0,
  'Cedula Escolar': 1,
  Pasaporte: 2,
  Extranjero: 3,
};

/** Devuelve la prioridad de un tipo de documento (desconocidos al final). */
function documentTypePriority(type: string | undefined | null): number {
  if (!type) return 99;
  return DOCUMENT_TYPE_PRIORITY[type] ?? 99;
}

/** Extrae la parte numérica de un documento para comparación ascendente. */
function numericDocument(doc: string | undefined | null): number {
  if (!doc) return 0;
  const parsed = parseInt(doc.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

/** Comparación de strings case-insensitive segura para null/undefined. */
function compareStrings(a: string | undefined | null, b: string | undefined | null): number {
  const sa = (a || '').trim().toLowerCase();
  const sb = (b || '').trim().toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

/**
 * Interface mínima que espera el comparador.
 * Cualquier objeto que tenga `student` (Person) o sea Person directamente
 * puede usarse con los wrappers de abajo.
 */
export interface SortableStudent {
  documentType?: string | null;
  document?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface SortableInscription {
  student?: SortableStudent | null;
  grade?: { order?: number | null; name?: string | null } | null;
  section?: { name?: string | null } | null;
}

/**
 * Comparador canónico para dos objetos Person (o cualquier objeto con
 * documentType/document/firstName/lastName).
 */
export function compareStudents(a: SortableStudent, b: SortableStudent): number {
  // 1. Tipo de documento
  const typeDiff = documentTypePriority(a.documentType) - documentTypePriority(b.documentType);
  if (typeDiff !== 0) return typeDiff;

  // 2. Número de cédula ascendente (numérico)
  const docDiff = numericDocument(a.document) - numericDocument(b.document);
  if (docDiff !== 0) return docDiff;

  // 3. Apellido
  const lastDiff = compareStrings(a.lastName, b.lastName);
  if (lastDiff !== 0) return lastDiff;

  // 4. Nombre
  return compareStrings(a.firstName, b.firstName);
}

/**
 * Comparador canónico para Inscription (u objetos con `student` anidado).
 * Incluye año/grado y sección como criterios 5 y 6.
 */
export function compareInscriptions(a: SortableInscription, b: SortableInscription): number {
  const aStudent = a.student;
  const bStudent = b.student;

  // Si no hay student, mandar al final
  if (!aStudent && !bStudent) return 0;
  if (!aStudent) return 1;
  if (!bStudent) return -1;

  const base = compareStudents(aStudent, bStudent);
  if (base !== 0) return base;

  // 5. Año / grado (por order, fallback name)
  const aGradeOrder = a.grade?.order ?? 9999;
  const bGradeOrder = b.grade?.order ?? 9999;
  if (aGradeOrder !== bGradeOrder) return aGradeOrder - bGradeOrder;
  const gradeNameDiff = compareStrings(a.grade?.name, b.grade?.name);
  if (gradeNameDiff !== 0) return gradeNameDiff;

  // 6. Sección
  return compareStrings(a.section?.name, b.section?.name);
}

/**
 * Ordena in-place un array de Inscriptions (u objetos con `.student`)
 * usando el comparador canónico. Retorna el mismo array por conveniencia.
 */
export function sortInscriptions<T extends SortableInscription>(arr: T[]): T[] {
  arr.sort(compareInscriptions as (a: T, b: T) => number);
  return arr;
}

/**
 * Ordena in-place un array de Person (u objetos con documentType/document/...)
 * usando el comparador canónico. Retorna el mismo array por conveniencia.
 */
export function sortStudents<T extends SortableStudent>(arr: T[]): T[] {
  arr.sort(compareStudents as (a: T, b: T) => number);
  return arr;
}
