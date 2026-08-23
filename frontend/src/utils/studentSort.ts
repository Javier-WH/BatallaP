/**
 * studentSort
 *
 * Fuente única para el orden canónico de estudiantes en el frontend
 * (nómina, boletines, actas, plantillas, etc.).
 *
 * Reglas de ordenamiento (de menor a mayor prioridad):
 *  1. Tipo de documento: Venezolano → Cédula Escolar → Pasaporte → Extranjero.
 *  2. Número de cédula ascendente (numérico).
 *  3. Apellido (lexicográfico, case-insensitive).
 *  4. Nombre (lexicográfico, case-insensitive).
 *  5. Año / grado (ascendente por `gradeOrder`, fallback `gradeName`).
 *  6. Sección (ascendente por `sectionName`).
 *
 * Debe mantenerse sincronizado con `backend/src/services/studentSortService.ts`.
 */

export type StudentDocumentType =
  | 'Venezolano'
  | 'Cedula Escolar'
  | 'Pasaporte'
  | 'Extranjero';

const DOCUMENT_TYPE_PRIORITY: Record<string, number> = {
  Venezolano: 0,
  'Cedula Escolar': 1,
  Pasaporte: 2,
  Extranjero: 3,
};

function documentTypePriority(type: string | undefined | null): number {
  if (!type) return 99;
  return DOCUMENT_TYPE_PRIORITY[type] ?? 99;
}

function numericDocument(doc: string | undefined | null): number {
  if (!doc) return 0;
  const parsed = parseInt(doc.replace(/\D/g, ''), 10);
  return isNaN(parsed) ? 0 : parsed;
}

function compareStrings(a: string | undefined | null, b: string | undefined | null): number {
  const sa = (a || '').trim().toLowerCase();
  const sb = (b || '').trim().toLowerCase();
  if (sa < sb) return -1;
  if (sa > sb) return 1;
  return 0;
}

export interface SortableStudent {
  documentType?: string | null;
  document?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface SortableNominaStudent {
  student?: SortableStudent | null;
}

export interface SortableBoletinStudent extends SortableStudent {
  sectionName?: string | null;
  gradeOrder?: number | null;
  gradeName?: string | null;
}

/**
 * Comparador canónico para dos objetos Student (documentType/document/firstName/lastName).
 */
export function compareStudents(a: SortableStudent, b: SortableStudent): number {
  const typeDiff = documentTypePriority(a.documentType) - documentTypePriority(b.documentType);
  if (typeDiff !== 0) return typeDiff;

  const docDiff = numericDocument(a.document) - numericDocument(b.document);
  if (docDiff !== 0) return docDiff;

  const lastDiff = compareStrings(a.lastName, b.lastName);
  if (lastDiff !== 0) return lastDiff;

  return compareStrings(a.firstName, b.firstName);
}

/**
 * Comparador para inscripciones de nómina (con `student` anidado).
 */
export function compareNominaStudents(a: SortableNominaStudent, b: SortableNominaStudent): number {
  const aStudent = a.student;
  const bStudent = b.student;
  if (!aStudent && !bStudent) return 0;
  if (!aStudent) return 1;
  if (!bStudent) return -1;
  return compareStudents(aStudent, bStudent);
}

/**
 * Comparador para estudiantes de boletín (incluye sección y grado).
 */
export function compareBoletinStudents(a: SortableBoletinStudent, b: SortableBoletinStudent): number {
  // Sort by section first (boletines group by section)
  const sectionDiff = compareStrings(a.sectionName, b.sectionName);
  if (sectionDiff !== 0) return sectionDiff;

  const base = compareStudents(a, b);
  if (base !== 0) return base;

  // Grade order
  const aGradeOrder = a.gradeOrder ?? 9999;
  const bGradeOrder = b.gradeOrder ?? 9999;
  if (aGradeOrder !== bGradeOrder) return aGradeOrder - bGradeOrder;
  return compareStrings(a.gradeName, b.gradeName);
}

/**
 * Ordena in-place un array de inscripciones de nómina.
 */
export function sortNominaStudents<T extends SortableNominaStudent>(arr: T[]): T[] {
  arr.sort(compareNominaStudents as (a: T, b: T) => number);
  return arr;
}

/**
 * Ordena in-place un array de estudiantes de boletín.
 */
export function sortBoletinStudents<T extends SortableBoletinStudent>(arr: T[]): T[] {
  arr.sort(compareBoletinStudents as (a: T, b: T) => number);
  return arr;
}
