"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quoteIdentifier = quoteIdentifier;
exports.quoteQualified = quoteQualified;
exports.fieldExpr = fieldExpr;
exports.castUnsigned = castUnsigned;
exports.lower = lower;
exports.compareStudents = compareStudents;
exports.compareInscriptions = compareInscriptions;
exports.sortInscriptions = sortInscriptions;
exports.sortStudents = sortStudents;
exports.numericDocumentSQL = numericDocumentSQL;
exports.canonicalInscriptionOrder = canonicalInscriptionOrder;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
/**
 * Returns true when the active Sequelize dialect is SQLite.
 * Used to emit portable SQL across MySQL (production) and SQLite (tests).
 */
function isSqliteDialect() {
    try {
        return database_1.default.getDialect() === 'sqlite';
    }
    catch (_a) {
        return false;
    }
}
/**
 * Quotes a SQL identifier (column or table alias) using the dialect-appropriate
 * quoting character: backticks for MySQL, double quotes for SQLite.
 */
function quoteIdentifier(name) {
    return isSqliteDialect() ? `"${name}"` : `\`${name}\``;
}
/**
 * Quotes a qualified identifier like `student`.`document` →
 * `"student"."document"` on SQLite, `student`.`document` on MySQL.
 */
function quoteQualified(tableAlias, column) {
    return `${quoteIdentifier(tableAlias)}.${quoteIdentifier(column)}`;
}
/**
 * Portable CASE expression that mirrors MySQL's `FIELD(x, a, b, c)`:
 * returns the 1-based index of `x` in the list, or 0 when not found.
 *
 * SQLite has no `FIELD()` function, so we emit an equivalent `CASE WHEN`.
 */
function fieldExpr(column, values) {
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
function castUnsigned(expr) {
    return isSqliteDialect() ? `CAST(${expr} AS INTEGER)` : `CAST(${expr} AS UNSIGNED)`;
}
/**
 * Portable LOWER() — both MySQL and SQLite support it, but this helper
 * exists for symmetry with the other helpers.
 */
function lower(expr) {
    return `LOWER(${expr})`;
}
/** Prioridad de tipo de documento (menor = aparece primero). */
const DOCUMENT_TYPE_PRIORITY = {
    Venezolano: 0,
    'Cedula Escolar': 1,
    Pasaporte: 2,
    Extranjero: 3,
};
/** Devuelve la prioridad de un tipo de documento (desconocidos al final). */
function documentTypePriority(type) {
    var _a;
    if (!type)
        return 99;
    return (_a = DOCUMENT_TYPE_PRIORITY[type]) !== null && _a !== void 0 ? _a : 99;
}
/** Extrae la parte numérica de un documento para comparación ascendente. */
function numericDocument(doc) {
    if (!doc)
        return 0;
    const parsed = parseInt(doc.replace(/\D/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
}
/** Comparación de strings case-insensitive segura para null/undefined. */
function compareStrings(a, b) {
    const sa = (a || '').trim().toLowerCase();
    const sb = (b || '').trim().toLowerCase();
    if (sa < sb)
        return -1;
    if (sa > sb)
        return 1;
    return 0;
}
/**
 * Comparador canónico para dos objetos Person (o cualquier objeto con
 * documentType/document/firstName/lastName).
 */
function compareStudents(a, b) {
    // 1. Tipo de documento
    const typeDiff = documentTypePriority(a.documentType) - documentTypePriority(b.documentType);
    if (typeDiff !== 0)
        return typeDiff;
    // 2. Número de cédula ascendente (numérico)
    const docDiff = numericDocument(a.document) - numericDocument(b.document);
    if (docDiff !== 0)
        return docDiff;
    // 3. Apellido
    const lastDiff = compareStrings(a.lastName, b.lastName);
    if (lastDiff !== 0)
        return lastDiff;
    // 4. Nombre
    return compareStrings(a.firstName, b.firstName);
}
/**
 * Comparador canónico para Inscription (u objetos con `student` anidado).
 * Incluye año/grado y sección como criterios 5 y 6.
 */
function compareInscriptions(a, b) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const aStudent = a.student;
    const bStudent = b.student;
    // Si no hay student, mandar al final
    if (!aStudent && !bStudent)
        return 0;
    if (!aStudent)
        return 1;
    if (!bStudent)
        return -1;
    const base = compareStudents(aStudent, bStudent);
    if (base !== 0)
        return base;
    // 5. Año / grado (por order, fallback name)
    const aGradeOrder = (_b = (_a = a.grade) === null || _a === void 0 ? void 0 : _a.order) !== null && _b !== void 0 ? _b : 9999;
    const bGradeOrder = (_d = (_c = b.grade) === null || _c === void 0 ? void 0 : _c.order) !== null && _d !== void 0 ? _d : 9999;
    if (aGradeOrder !== bGradeOrder)
        return aGradeOrder - bGradeOrder;
    const gradeNameDiff = compareStrings((_e = a.grade) === null || _e === void 0 ? void 0 : _e.name, (_f = b.grade) === null || _f === void 0 ? void 0 : _f.name);
    if (gradeNameDiff !== 0)
        return gradeNameDiff;
    // 6. Sección
    return compareStrings((_g = a.section) === null || _g === void 0 ? void 0 : _g.name, (_h = b.section) === null || _h === void 0 ? void 0 : _h.name);
}
/**
 * Ordena in-place un array de Inscriptions (u objetos con `.student`)
 * usando el comparador canónico. Retorna el mismo array por conveniencia.
 */
function sortInscriptions(arr) {
    arr.sort(compareInscriptions);
    return arr;
}
/**
 * Ordena in-place un array de Person (u objetos con documentType/document/...)
 * usando el comparador canónico. Retorna el mismo array por conveniencia.
 */
function sortStudents(arr) {
    arr.sort(compareStudents);
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
function numericDocumentSQL(columnExpr) {
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
function canonicalInscriptionOrder() {
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
        [(0, sequelize_1.literal)(fieldExpr(studentDocType, ['Venezolano', 'Cedula Escolar', 'Pasaporte', 'Extranjero'])), 'ASC'],
        // 2. numeric part of document ascending. NULL/empty → 0 (matches numericDocument()).
        [(0, sequelize_1.literal)(numericDocumentSQL(studentDoc)), 'ASC'],
        // 3. lastName (case-insensitive via LOWER()).
        [(0, sequelize_1.literal)(lower(studentLast)), 'ASC'],
        // 4. firstName (case-insensitive via LOWER()).
        [(0, sequelize_1.literal)(lower(studentFirst)), 'ASC'],
        // 5. grade.order (NULL → 9999), then grade.name.
        [(0, sequelize_1.literal)(`COALESCE(${gradeOrder}, 9999)`), 'ASC'],
        [(0, sequelize_1.literal)(lower(gradeName)), 'ASC'],
        // 6. section.name (case-insensitive).
        [(0, sequelize_1.literal)(lower(sectionName)), 'ASC'],
        // 7. Final stable tiebreaker on the primary key of Inscription.
        ['id', 'ASC'],
    ];
}
