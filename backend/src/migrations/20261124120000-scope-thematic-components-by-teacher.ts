import { QueryInterface, QueryTypes, DataTypes, Transaction } from 'sequelize';

/**
 * Scopes thematic content per teacher.
 *
 * Until now `thematic_components` was shared by every section of the same
 * periodGradeSubject + term (see 20260822100000-drop-section-from-thematic-
 * components), so two teachers of the same subject/year in different sections
 * saw — and could edit — each other's content.
 *
 * Adds `teacherId` and backfills it. For each periodGradeSubject whose content
 * is still unscoped:
 *   - the teacher whose evaluations reference that content the most keeps the
 *     original rows;
 *   - every other teacher of that subject/year receives a full copy
 *     (components → contents → expected learnings + links), and the evaluation
 *     plans and revision selections of that teacher's sections are remapped to
 *     the copies.
 * Copies keep the original timestamps so the activity feed is not flooded.
 *
 * Idempotent: only rows with `teacherId IS NULL` are processed. Subjects with no
 * teacher assigned are left unscoped (NULL).
 */

type Row = Record<string, any>;

const parseIds = (raw: unknown): number[] | null => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(Number) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export async function up(queryInterface: QueryInterface): Promise<void> {
  const sequelize = queryInterface.sequelize;

  const columns = await queryInterface.describeTable('thematic_components');
  if (!columns.teacherId) {
    await queryInterface.addColumn('thematic_components', 'teacherId', {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addIndex('thematic_components', ['periodGradeSubjectId', 'termId', 'teacherId'], {
      name: 'idx_thematic_components_scope',
    });
  }

  await sequelize.transaction(async (transaction: Transaction) => {
    const select = (sql: string, replacements: Row = {}) =>
      sequelize.query<Row>(sql, { type: QueryTypes.SELECT, replacements, transaction });
    const exec = (sql: string, replacements: Row = {}) =>
      sequelize.query(sql, { replacements, transaction });
    const insert = async (sql: string, replacements: Row): Promise<number> => {
      const [insertId] = await sequelize.query(sql, { type: QueryTypes.INSERT, replacements, transaction });
      return Number(insertId);
    };

    const pgsRows = await select(
      `SELECT DISTINCT periodGradeSubjectId AS pgsId FROM thematic_components WHERE teacherId IS NULL`
    );

    for (const { pgsId } of pgsRows) {
      const components = await select(
        `SELECT * FROM thematic_components WHERE periodGradeSubjectId = :pgsId AND teacherId IS NULL ORDER BY id`,
        { pgsId }
      );
      if (components.length === 0) continue;

      const assignments = await select(
        `SELECT teacherId, sectionId FROM teacher_assignments WHERE periodGradeSubjectId = :pgsId`,
        { pgsId }
      );
      const sectionsByTeacher = new Map<number, number[]>();
      for (const a of assignments) {
        const list = sectionsByTeacher.get(a.teacherId) ?? [];
        list.push(a.sectionId);
        sectionsByTeacher.set(a.teacherId, list);
      }
      if (sectionsByTeacher.size === 0) continue;

      const componentIds = components.map(c => c.id);
      const contents = componentIds.length
        ? await select(`SELECT * FROM thematic_contents WHERE thematicComponentId IN (:componentIds) ORDER BY id`, { componentIds })
        : [];
      const contentIds = contents.map(c => c.id);
      const links = contentIds.length
        ? await select(`SELECT * FROM expected_learning_contents WHERE contentId IN (:contentIds)`, { contentIds })
        : [];
      const learningIds = [...new Set(links.map(l => l.learningId))];
      const learnings = learningIds.length
        ? await select(`SELECT * FROM expected_learnings WHERE id IN (:learningIds) ORDER BY id`, { learningIds })
        : [];

      const plans = await select(
        `SELECT id, sectionId, thematicComponentId, thematicContentIds FROM evaluation_plans WHERE periodGradeSubjectId = :pgsId`,
        { pgsId }
      );
      const componentIdSet = new Set(componentIds);
      const contentIdSet = new Set(contentIds);

      // Owner of the original rows: the teacher whose sections' evaluations use
      // this content the most (ties → lowest teacherId).
      const usage = (teacherId: number) => {
        const sections = new Set(sectionsByTeacher.get(teacherId));
        return plans.filter(p =>
          sections.has(p.sectionId) &&
          (componentIdSet.has(p.thematicComponentId) || (parseIds(p.thematicContentIds) ?? []).some(id => contentIdSet.has(id)))
        ).length;
      };
      const teachers = [...sectionsByTeacher.keys()].sort((a, b) => usage(b) - usage(a) || a - b);
      const [owner, ...others] = teachers;

      await exec(`UPDATE thematic_components SET teacherId = :owner WHERE id IN (:componentIds)`, { owner, componentIds });

      for (const teacherId of others) {
        const componentMap = new Map<number, number>();
        const contentMap = new Map<number, number>();
        const learningMap = new Map<number, number>();

        for (const c of components) {
          componentMap.set(c.id, await insert(
            `INSERT INTO thematic_components (periodGradeSubjectId, termId, teacherId, title, \`order\`, createdAt, updatedAt)
             VALUES (:pgsId, :termId, :teacherId, :title, :order, :createdAt, :updatedAt)`,
            { pgsId, termId: c.termId, teacherId, title: c.title, order: c.order, createdAt: c.createdAt, updatedAt: c.updatedAt }
          ));
        }
        for (const ct of contents) {
          contentMap.set(ct.id, await insert(
            `INSERT INTO thematic_contents (thematicComponentId, title, \`order\`, createdAt, updatedAt)
             VALUES (:componentId, :title, :order, :createdAt, :updatedAt)`,
            { componentId: componentMap.get(ct.thematicComponentId), title: ct.title, order: ct.order, createdAt: ct.createdAt, updatedAt: ct.updatedAt }
          ));
        }
        for (const l of learnings) {
          learningMap.set(l.id, await insert(
            `INSERT INTO expected_learnings (description, \`order\`, createdAt, updatedAt)
             VALUES (:description, :order, :createdAt, :updatedAt)`,
            { description: l.description, order: l.order, createdAt: l.createdAt, updatedAt: l.updatedAt }
          ));
        }
        for (const link of links) {
          await insert(
            `INSERT INTO expected_learning_contents (learningId, contentId, createdAt, updatedAt)
             VALUES (:learningId, :contentId, :createdAt, :updatedAt)`,
            { learningId: learningMap.get(link.learningId), contentId: contentMap.get(link.contentId), createdAt: link.createdAt, updatedAt: link.updatedAt }
          );
        }

        // Point this teacher's evaluations and revision selections to the copies
        const sections = new Set(sectionsByTeacher.get(teacherId));
        for (const plan of plans.filter(p => sections.has(p.sectionId))) {
          const oldContentIds = parseIds(plan.thematicContentIds);
          const newComponentId = plan.thematicComponentId != null
            ? componentMap.get(plan.thematicComponentId) ?? plan.thematicComponentId
            : null;
          const newContentIds = oldContentIds
            ? JSON.stringify([...new Set(oldContentIds.map(id => contentMap.get(id) ?? id))])
            : null;
          if (newComponentId === plan.thematicComponentId && newContentIds === (oldContentIds ? JSON.stringify(oldContentIds) : null)) continue;
          await exec(
            `UPDATE evaluation_plans SET thematicComponentId = :newComponentId, thematicContentIds = :newContentIds WHERE id = :id`,
            { newComponentId, newContentIds, id: plan.id }
          );
        }

        const selections = await select(
          `SELECT id, sectionId, thematicComponentIds FROM revision_thematic_selections WHERE periodGradeSubjectId = :pgsId`,
          { pgsId }
        );
        for (const sel of selections.filter(s => sections.has(s.sectionId))) {
          const ids = parseIds(sel.thematicComponentIds);
          if (!ids) continue;
          await exec(
            `UPDATE revision_thematic_selections SET thematicComponentIds = :ids WHERE id = :id`,
            { ids: JSON.stringify(ids.map(id => componentMap.get(id) ?? id)), id: sel.id }
          );
        }
      }

      console.log(`   pgs ${pgsId}: ${components.length} componente(s) → profesor ${owner}` +
        (others.length ? `, copiados a ${others.length} profesor(es) más` : ''));
    }
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Copies cannot be merged back automatically; only the column is removed.
  await queryInterface.removeIndex('thematic_components', 'idx_thematic_components_scope');
  await queryInterface.removeColumn('thematic_components', 'teacherId');
}
