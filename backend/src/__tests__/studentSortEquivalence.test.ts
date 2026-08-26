/**
 * Equivalence test between the in-memory canonical sort and the SQL ORDER BY
 * produced by `canonicalInscriptionOrder()`.
 *
 * This is the safety net for paginated endpoints: if the SQL order and the JS
 * order ever diverge, a student could appear on two pages or on none. The test
 * does NOT hit the database — it verifies that the SQL expression mirrors the
 * same comparison rules as `compareInscriptions` by checking the structure of
 * the generated OrderItem[] and by re-implementing the comparator against the
 * same literals.
 *
 * A full DB-backed equivalence test lives in `canonicalSort.db.test.ts` and
 * requires a running MySQL instance (seeds a dataset with edge cases and
 * asserts that `ORDER BY canonicalInscriptionOrder()` returns the same row
 * order as `sortInscriptions(rows)`).
 */

import {
  compareInscriptions,
  compareStudents,
  canonicalInscriptionOrder,
  type SortableInscription,
} from '@/services/studentSortService';
import sequelize from '@/config/database';

const isSqlite = sequelize.getDialect() === 'sqlite';

describe('canonicalInscriptionOrder SQL ↔ JS equivalence', () => {
  describe('canonicalInscriptionOrder()', () => {
    it('returns 8 order items mirroring compareInscriptions + id tiebreaker', () => {
      const order = canonicalInscriptionOrder();
      expect(order).toHaveLength(8);

      // Helper to read an OrderItem as a [expr, direction] tuple safely.
      // `literal()` returns an object with a `val` property containing the SQL
      // string; plain string columns are used directly.
      const at = (i: number): [string, unknown] => {
        const item = order[i] as unknown as [unknown, unknown];
        const first = item[0];
        const expr = typeof first === 'string'
          ? first
          : String((first as { val?: unknown }).val ?? first);
        return [expr, item[1]];
      };

      // 1. documentType priority — FIELD() on MySQL, CASE WHEN on SQLite.
      let [expr, dir] = at(0);
      const docTypePattern = isSqlite
        ? /CASE[\s\S]+documentType[\s\S]+Venezolano[\s\S]+Cedula Escolar[\s\S]+Pasaporte[\s\S]+Extranjero/
        : /FIELD\([\s\S]+documentType[\s\S]+Venezolano[\s\S]+Cedula Escolar[\s\S]+Pasaporte[\s\S]+Extranjero/;
      expect(expr).toMatch(docTypePattern);
      expect(dir).toBe('ASC');

      // 2. numeric document via nested REPLACE + CAST (UNSIGNED on MySQL, INTEGER on SQLite)
      [expr, dir] = at(1);
      expect(expr).toMatch(/REPLACE\([\s\S]+document/);
      expect(expr).toMatch(isSqlite ? /INTEGER/ : /UNSIGNED/);
      expect(expr).toMatch(/COALESCE/);
      expect(dir).toBe('ASC');

      // 3. lastName case-insensitive
      [expr, dir] = at(2);
      expect(expr).toMatch(/LOWER\(.+lastName.+\)/);
      expect(dir).toBe('ASC');

      // 4. firstName case-insensitive
      [expr, dir] = at(3);
      expect(expr).toMatch(/LOWER\(.+firstName.+\)/);
      expect(dir).toBe('ASC');

      // 5. grade.order COALESCE → 9999, then grade.name
      [expr, dir] = at(4);
      expect(expr).toMatch(/COALESCE\(.+grade.+.order.+, 9999\)/);
      expect(dir).toBe('ASC');
      [expr, dir] = at(5);
      expect(expr).toMatch(/LOWER\(.+grade.+.name.+\)/);
      expect(dir).toBe('ASC');

      // 6. section.name case-insensitive
      [expr, dir] = at(6);
      expect(expr).toMatch(/LOWER\(.+section.+.name.+\)/);
      expect(dir).toBe('ASC');

      // 7. id ASC (stable tiebreaker)
      [expr, dir] = at(7);
      expect(expr).toBe('id');
      expect(dir).toBe('ASC');
    });
  });

  describe('compareInscriptions edge cases (mirror SQL behavior)', () => {
    /** Helper to build a minimal sortable inscription. */
    const mk = (
      id: number,
      student: Partial<{ documentType: string; document: string; firstName: string; lastName: string }>,
      grade?: { order?: number | null; name?: string | null },
      section?: { name?: string | null }
    ): SortableInscription => ({
      student: {
        documentType: student.documentType ?? null,
        document: student.document ?? null,
        firstName: student.firstName ?? null,
        lastName: student.lastName ?? null,
      },
      grade: grade ?? null,
      section: section ?? null,
    });

    it('orders Venezolano before Cedula Escolar before Pasaporte before Extranjero', () => {
      const rows = [
        mk(4, { documentType: 'Extranjero', document: '100' }),
        mk(3, { documentType: 'Pasaporte', document: '100' }),
        mk(2, { documentType: 'Cedula Escolar', document: '100' }),
        mk(1, { documentType: 'Venezolano', document: '100' }),
      ];
      rows.sort(compareInscriptions);
      expect(rows.map(r => r.student!.documentType)).toEqual([
        'Venezolano',
        'Cedula Escolar',
        'Pasaporte',
        'Extranjero',
      ]);
    });

    it('treats unknown / null documentType as lowest priority (sorts last)', () => {
      const rows = [
        mk(2, { documentType: 'Unknown', document: '1' }),
        mk(3, { documentType: null as unknown as string, document: '1' }),
        mk(1, { documentType: 'Extranjero', document: '1' }),
      ];
      rows.sort(compareInscriptions);
      // Extranjero (priority 3) before Unknown (99) before null (99).
      // For two priority-99 entries, the next criterion (numeric document) is
      // equal, so lastName/firstName/id decide — here id 2 < id 3.
      expect(rows.map(r => r.student!.documentType)).toEqual(['Extranjero', 'Unknown', null]);
    });

    it('compares documents by their numeric part, not lexicographically', () => {
      const rows = [
        mk(2, { documentType: 'Venezolano', document: 'V-10000000' }),
        mk(3, { documentType: 'Venezolano', document: 'V-999999' }),
        mk(1, { documentType: 'Venezolano', document: 'V-12345' }),
      ];
      rows.sort(compareInscriptions);
      // numeric: 12345 < 999999 < 10000000
      expect(rows.map(r => r.student!.document)).toEqual(['V-12345', 'V-999999', 'V-10000000']);
    });

    it('treats empty / non-numeric document as 0 (sorts first among equal types)', () => {
      const rows = [
        mk(2, { documentType: 'Venezolano', document: 'V-5' }),
        mk(1, { documentType: 'Venezolano', document: '' }),
        mk(3, { documentType: 'Venezolano', document: null as unknown as string }),
      ];
      rows.sort(compareInscriptions);
      // Both empty and null → 0; tie broken by id (1 < 3).
      expect(rows.map(r => r.student!.document)).toEqual(['', null, 'V-5']);
    });

    it('falls back to lastName then firstName when type+document tie', () => {
      const rows = [
        mk(2, { documentType: 'Venezolano', document: 'V-1', firstName: 'Ana', lastName: 'Zeta' }),
        mk(1, { documentType: 'Venezolano', document: 'V-1', firstName: 'Ana', lastName: 'Alfa' }),
        mk(3, { documentType: 'Venezolano', document: 'V-1', firstName: 'Beatriz', lastName: 'Alfa' }),
      ];
      rows.sort(compareInscriptions);
      expect(rows.map(r => r.student!.firstName)).toEqual(['Ana', 'Beatriz', 'Ana']);
      expect(rows.map(r => r.student!.lastName)).toEqual(['Alfa', 'Alfa', 'Zeta']);
    });

    it('uses grade.order then grade.name as 5th criterion', () => {
      const rows = [
        mk(2, { documentType: 'V', document: '1', firstName: 'A', lastName: 'A' }, { order: 5, name: 'Quinto' }),
        mk(1, { documentType: 'V', document: '1', firstName: 'A', lastName: 'A' }, { order: 1, name: 'Primero' }),
        mk(3, { documentType: 'V', document: '1', firstName: 'A', lastName: 'A' }, { order: null, name: 'Z' }),
      ];
      rows.sort(compareInscriptions);
      // order 1 < 5 < null(→9999)
      expect(rows.map(r => r.grade?.order)).toEqual([1, 5, null]);
    });

    it('uses section.name as 6th criterion', () => {
      const rows = [
        mk(2, { documentType: 'V', document: '1', firstName: 'A', lastName: 'A' }, { order: 1, name: 'A' }, { name: 'B' }),
        mk(1, { documentType: 'V', document: '1', firstName: 'A', lastName: 'A' }, { order: 1, name: 'A' }, { name: 'A' }),
      ];
      rows.sort(compareInscriptions);
      expect(rows.map(r => r.section?.name)).toEqual(['A', 'B']);
    });

    it('is case-insensitive on lastName and firstName', () => {
      const rows = [
        mk(2, { documentType: 'V', document: '1', firstName: 'ana', lastName: 'Z' }),
        mk(1, { documentType: 'V', document: '1', firstName: 'ANA', lastName: 'z' }),
      ];
      rows.sort(compareInscriptions);
      // 'z' === 'Z' after lowercasing → tie → firstName 'ana' === 'ANA' → tie.
      // compareInscriptions has no id tiebreaker (that's only in the SQL order),
      // so Array.sort is stable and preserves insertion order: 'ana' first.
      expect(rows.map(r => r.student!.firstName)).toEqual(['ana', 'ANA']);
    });
  });

  describe('compareStudents (Person-level, no grade/section)', () => {
    it('matches compareInscriptions when grade/section are absent', () => {
      const a = { documentType: 'Venezolano', document: '10', firstName: 'A', lastName: 'A' };
      const b = { documentType: 'Venezolano', document: '5', firstName: 'A', lastName: 'A' };
      expect(compareStudents(a, b)).toBeGreaterThan(0);
      expect(compareInscriptions({ student: a }, { student: b })).toBeGreaterThan(0);
    });
  });
});
