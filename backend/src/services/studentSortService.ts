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

import { literal, type OrderItem } from 'sequelize';
import sequelize from '@/config/database';

export type StudentDocumentType =
  | 'Venezolano'
  | 'Cedula Escolar'
  | 'Pasaporte'
  | 'Extranjero';

/**
 * Returns true when the active Sequelize dialect is SQLite.
 * Used to emit portable SQL across MySQL (production) and SQLite (tests).
 */
function isSqliteDialect(): boolean {
  try {
    return sequelize.getDialect() === 'sqlite';
  } catch {
    return false;
  }
}

/**
 * Quotes a SQL identifier (column or table alias) using the dialect-appropriate
 * quoting character: backticks for MySQL, double quotes for SQLite.
 */
export function quoteIdentifier(name: string): string {
  return isSqliteDialect() ? `"${name}"` : `\`${name}\``;
}

/**
 * Quotes a qualified identifier like `student`.`document` →
 * `"student"."document"` on SQLite, `student`.`document` on MySQL.
 */
export function quoteQualified(tableAlias: string, column: string): string {
  return `${quoteIdentifier(tableAlias)}.${quoteIdentifier(column)}`;
}

/**
 * Portable CASE expression that mirrors MySQL's `FIELD(x, a, b, c)`:
 * returns the 1-based index of `x` in the list, or 0 when not found.
 *
 * SQLite has no `FIELD()` function, so we emit an equivalent `CASE WHEN`.
 */
export function fieldExpr(column: string, values: string[]): string {
  if (!isSqliteDialect()) {
    return `FIELD(${column}, ${values.map((v) => `'${v}'`).join(', ')})`;
  }
  const whens = values
    .map((v, i) => `WHEN ${column} = '${v}' THEN ${i + 1}`)
    .join(' ');
  return `CASE ${whens} ELSE 0 END`;
}

/**
 * Portable cast to an unsigned/integer type. MySQL uses `AS UNSIGNED`,
 * SQLite uses `AS INTEGER`.
 */
export function castUnsigned(expr: string): string {
  return isSqliteDialect() ? `CAST(${expr} AS INTEGER)` : `CAST(${expr} AS UNSIGNED)`;
}

/**
 * Portable LOWER() — both MySQL and SQLite support it, but this helper
 * exists for symmetry with the other helpers.
 */
export function lower(expr: string): string {
  return `LOWER(${expr})`;
}

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

// ---------------------------------------------------------------------------
// SQL mirror of the canonical ordering above.
//
// Used by paginated endpoints so that `LIMIT`/`OFFSET` produce pages that are
// globally consistent with the in-memory `sortInscriptions` order. Without
// this, pages would be internally sorted but a student could appear on two
// pages or on none, because the JS sort runs AFTER the SQL slice.
//
// The SQL expression mirrors `compareInscriptions` exactly:
//   1. documentType priority (Venezolano=0, Cedula Escolar=1, Pasaporte=2, Extranjero=3, else=99)
//   2. numeric part of document ascending
//   3. lastName (case-insensitive)
//   4. firstName (case-insensitive)
//   5. grade.order (fallback 9999), then grade.name
//   6. section.name
//   7. Inscription.id ASC — final tiebreaker to guarantee a TOTAL, STABLE order
//      (required for safe pagination; without it, ties could reorder between pages).
// ---------------------------------------------------------------------------

/**
 * Portable SQL expression that extracts the numeric part of a document string,
 * mirroring the JS `numericDocument()` helper. Uses nested `REPLACE()` instead
 * of `REGEXP_REPLACE()` because the latter is not available in MySQL < 8.0.4
 * or some MariaDB versions.
 *
 * Strips the common Venezuelan document characters: V, E, P, C (upper/lower),
 * hyphens, dots, and spaces. This covers all practical document formats:
 *   "V-12345678", "E-87654321", "12.345.678", "CE-12345", "P-99999999", etc.
 *
 * @param columnExpr - SQL column reference, e.g. "`student`.`document`"
 * @returns SQL expression that evaluates to an UNSIGNED integer (0 for empty/null)
 */
export function numericDocumentSQL(columnExpr: string): string {
  // Order matters: strip letters first, then separators, then spaces.
  // Each REPLACE wraps the previous one.
  const chars = ['V', 'v', 'E', 'e', 'P', 'p', 'C', 'c', '-', '.', ' '];
  let expr = columnExpr;
  for (const ch of chars) {
    expr = `REPLACE(${expr}, '${ch}', '')`;
  }
  // NULLIF(..., '') converts empty string to NULL, COALESCE(..., 0) → 0 to match JS.
  return castUnsigned(`COALESCE(NULLIF(${expr}, ''), 0)`);
}

/**
 * Returns a Sequelize `OrderItem[]` that reproduces the canonical ordering at
 * the SQL level, assuming the `Person` model is aliased as `student` and the
 * `Grade`/`Section` models are included with their canonical aliases.
 *
 * The caller is responsible for ensuring those associations are present in the
 * `include` array (they already are in `getInscriptions` and `getMatriculations`).
 */
export function canonicalInscriptionOrder(): OrderItem[] {
  const studentDocType = quoteQualified('student', 'documentType');
  const studentDoc = quoteQualified('student', 'document');
  const studentLast = quoteQualified('student', 'lastName');
  const studentFirst = quoteQualified('student', 'firstName');
  const gradeOrder = quoteQualified('grade', 'order');
  const gradeName = quoteQualified('grade', 'name');
  const sectionName = quoteQualified('section', 'name');

  return [
    // 1. documentType priority via FIELD()/CASE — lower priority value first.
    //    Unknown / NULL types get 99 so they sort last, matching documentTypePriority().
    [literal(fieldExpr(studentDocType, ['Venezolano', 'Cedula Escolar', 'Pasaporte', 'Extranjero'])), 'ASC'],
    // 2. numeric part of document ascending. NULL/empty → 0 (matches numericDocument()).
    [literal(numericDocumentSQL(studentDoc)), 'ASC'],
    // 3. lastName (case-insensitive via LOWER()).
    [literal(lower(studentLast)), 'ASC'],
    // 4. firstName (case-insensitive via LOWER()).
    [literal(lower(studentFirst)), 'ASC'],
    // 5. grade.order (NULL → 9999), then grade.name.
    [literal(`COALESCE(${gradeOrder}, 9999)`), 'ASC'],
    [literal(lower(gradeName)), 'ASC'],
    // 6. section.name (case-insensitive).
    [literal(lower(sectionName)), 'ASC'],
    // 7. Final stable tiebreaker on the primary key of Inscription.
    ['id', 'ASC'],
  ];
}
