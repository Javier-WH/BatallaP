import { QueryInterface, QueryTypes } from 'sequelize';
import { normalizeDocumentNumber } from '../utils/documentNumber';

/**
 * Regla: las cédulas (Venezolano/Extranjero) y cédulas escolares se guardan
 * solo con dígitos; la letra V/E se deriva de `documentType` al mostrarla.
 *
 * Normaliza `people.document` y `guardian_profiles.document` (p. ej.
 * "V-12.345.678" → "12345678"). NO destructiva: no borra filas y OMITE (con
 * log) los valores que colisionarían con un documento ya existente o que no
 * contienen dígitos, para revisarlos manualmente. Pasaportes no se tocan.
 *
 * Idempotente. El `down` no revierte (la letra era redundante con documentType).
 */
type Row = { id: number; documentType: string; document: string | null };

const NUMERIC_TYPES = new Set(['Venezolano', 'Extranjero', 'Cedula Escolar']);

const normalizeTable = async (
  qi: QueryInterface,
  table: 'people' | 'guardian_profiles',
  uniqueScope: 'global' | 'perType'
) => {
  const q = qi.sequelize;
  const rows = await q.query<Row>(`SELECT id, documentType, document FROM ${table}`, { type: QueryTypes.SELECT });
  const key = (r: { documentType: string; document: string | null }) =>
    uniqueScope === 'global' ? String(r.document) : `${r.documentType}|${r.document}`;
  const taken = new Set(rows.filter(r => r.document).map(key));

  let updated = 0;
  const skipped: string[] = [];
  for (const row of rows) {
    if (!row.document || !NUMERIC_TYPES.has(row.documentType)) continue;
    if (!/\d/.test(row.document)) {
      skipped.push(`#${row.id} "${row.document}" (sin dígitos)`);
      continue;
    }
    const normalized = normalizeDocumentNumber(row.documentType, row.document);
    if (normalized === row.document) continue;

    const target = { documentType: row.documentType, document: normalized };
    if (taken.has(key(target))) {
      skipped.push(`#${row.id} "${row.document}" → "${normalized}" ya existe`);
      continue;
    }

    await q.query(`UPDATE ${table} SET document = ? WHERE id = ?`, { replacements: [normalized, row.id] });
    taken.delete(key(row));
    taken.add(key(target));
    updated++;
  }

  console.log(`[migration] documents-digits-only: ${table} → ${updated} normalizados, ${skipped.length} omitidos`);
  for (const s of skipped) console.log(`[migration]   omitido ${table} ${s}`);
};

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    await normalizeTable(queryInterface, 'people', 'global');
    await normalizeTable(queryInterface, 'guardian_profiles', 'perType');
  },

  async down(): Promise<void> {
    // Irreversible normalization — intentionally a no-op.
  },
};
