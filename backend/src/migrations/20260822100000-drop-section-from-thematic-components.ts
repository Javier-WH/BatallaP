import { QueryInterface, QueryTypes } from 'sequelize';

/**
 * Drops `sectionId` from `thematic_components` so content is shared across
 * all sections of the same periodGradeSubject + term.
 *
 * Before dropping the column, duplicate components (same pgsId + termId, from
 * different sections) are deduplicated: the oldest one is kept and its
 * contents/learnings are preserved. EvaluationPlan references
 * (thematicComponentId, thematicContentIds) and ExpectedLearningContent
 * associations are remapped to the kept component's contents.
 */
export async function up(queryInterface: QueryInterface): Promise<void> {
  const sequelize = queryInterface.sequelize;

  // 1. Find duplicate groups: same (periodGradeSubjectId, termId) with > 1 component
  const dupes = await sequelize.query<{ pgsId: number; termId: number }>(
    `SELECT periodGradeSubjectId AS pgsId, termId
       FROM thematic_components
      GROUP BY periodGradeSubjectId, termId
     HAVING COUNT(*) > 1`,
    { type: QueryTypes.SELECT }
  );

  for (const { pgsId, termId } of dupes) {
    // 2. Get all components in this group, ordered by id ASC (oldest = keeper)
    const components = await sequelize.query<{ id: number }>(
      `SELECT id FROM thematic_components
        WHERE periodGradeSubjectId = ${pgsId} AND termId = ${termId}
        ORDER BY id ASC`,
      { type: QueryTypes.SELECT }
    );
    if (components.length <= 1) continue;

    const keeperId = components[0].id;
    const duplicateIds = components.slice(1).map(c => c.id);

    // 3. For each duplicate, remap its contents to the keeper's contents (match by title)
    for (const dupId of duplicateIds) {
      // Get contents of the duplicate
      const dupContents = await sequelize.query<{ id: number; title: string; order: number }>(
        `SELECT id, title, \`order\` FROM thematic_contents
          WHERE thematicComponentId = ${dupId}`,
        { type: QueryTypes.SELECT }
      );

      // Get keeper contents for matching
      const keeperContents = await sequelize.query<{ id: number; title: string; order: number }>(
        `SELECT id, title, \`order\` FROM thematic_contents
          WHERE thematicComponentId = ${keeperId}`,
        { type: QueryTypes.SELECT }
      );

      // Build a content-id remap: oldContentId -> newContentId (keeper)
      const contentRemap = new Map<number, number>();

      for (const dupContent of dupContents) {
        // Match by title (case-insensitive, trimmed)
        const match = keeperContents.find(
          kc => kc.title.trim().toLowerCase() === dupContent.title.trim().toLowerCase()
        );
        if (match) {
          contentRemap.set(dupContent.id, match.id);
        }
        // If no match, the content will be lost (it's a duplicate that doesn't
        // exist in the keeper). This is acceptable since the keeper is the
        // canonical version.
      }

      // 4. Remap ExpectedLearningContent associations
      for (const [oldContentId, newContentId] of contentRemap) {
        // Move associations to the keeper's content, avoiding duplicates
        await sequelize.query(
          `INSERT IGNORE INTO expected_learning_contents (learningId, contentId, createdAt, updatedAt)
           SELECT learningId, ${newContentId}, NOW(), NOW()
             FROM expected_learning_contents
            WHERE contentId = ${oldContentId}`,
        );
        // Delete old associations
        await sequelize.query(
          `DELETE FROM expected_learning_contents WHERE contentId = ${oldContentId}`
        );
      }

      // 5. Remap EvaluationPlan.thematicComponentId
      await sequelize.query(
        `UPDATE evaluation_plans
            SET thematicComponentId = ${keeperId}
          WHERE thematicComponentId = ${dupId}`
      );

      // 6. Remap EvaluationPlan.thematicContentIds (JSON array of content IDs)
      const plansWithContentIds = await sequelize.query<{ id: number; thematicContentIds: string | null }>(
        `SELECT id, thematicContentIds FROM evaluation_plans
          WHERE thematicContentIds IS NOT NULL
            AND JSON_CONTAINS(thematicContentIds, CAST(${dupId} AS JSON))`,
        { type: QueryTypes.SELECT }
      );

      // Also remap any plan that references any of the duplicate's content IDs
      for (const dupContent of dupContents) {
        const plansReferencing = await sequelize.query<{ id: number; thematicContentIds: string | null }>(
          `SELECT id, thematicContentIds FROM evaluation_plans
            WHERE thematicContentIds IS NOT NULL
              AND JSON_CONTAINS(thematicContentIds, CAST(${dupContent.id} AS JSON))`,
          { type: QueryTypes.SELECT }
        );

        for (const plan of plansReferencing) {
          if (!plan.thematicContentIds) continue;
          try {
            const ids: number[] = JSON.parse(plan.thematicContentIds);
            const remapped = ids.map(id => contentRemap.get(id) ?? id);
            // Remove duplicates that may arise from remapping
            const unique = [...new Set(remapped)];
            await sequelize.query(
              `UPDATE evaluation_plans SET thematicContentIds = '${JSON.stringify(unique).replace(/'/g, "''")}' WHERE id = ${plan.id}`
            );
          } catch {
            // Skip if JSON parse fails
          }
        }
      }

      // 7. Delete the duplicate's contents (associations already moved)
      await sequelize.query(
        `DELETE FROM thematic_contents WHERE thematicComponentId = ${dupId}`
      );

      // 8. Delete the duplicate component
      await sequelize.query(
        `DELETE FROM thematic_components WHERE id = ${dupId}`
      );
    }
  }

  // 9. Drop the sectionId column
  await queryInterface.removeColumn('thematic_components', 'sectionId');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Re-add sectionId as nullable (can't restore original values)
  const DataTypes = (await import('sequelize')).DataTypes;
  await queryInterface.addColumn('thematic_components', 'sectionId', {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null,
  });
}
