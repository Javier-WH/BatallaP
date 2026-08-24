import { QueryInterface } from 'sequelize';

// Consolidates per-section template assignments into per-grade assignments.
//
// Before this migration, templates could be assigned per (grade, section) or
// per grade. Now templates are strictly per-grade (all sections share the
// same template). This migration:
//  1. For each legacy per-section assignment, if no per-grade assignment
//     exists for that grade, promote the section assignment to a per-grade
//     assignment (first section wins).
//  2. Deletes all remaining per-section assignment keys.

export async function up(queryInterface: QueryInterface) {
  const [sectionRows]: any = await queryInterface.sequelize.query(`
    SELECT \`key\`, \`value\` FROM settings
    WHERE \`key\` LIKE 'template_assignment:grade:%:section:%'
  `);

  // Extract gradeId from each section key and pick the first per grade.
  const gradeToValue = new Map<number, string>();
  for (const row of sectionRows) {
    // key format: template_assignment:grade:<gradeId>:section:<sectionId>
    const match = row.key.match(/^template_assignment:grade:(\d+):section:\d+$/);
    if (!match) continue;
    const gradeId = Number(match[1]);
    if (!gradeToValue.has(gradeId)) {
      gradeToValue.set(gradeId, row.value);
    }
  }

  // Promote to per-grade where no per-grade assignment exists.
  for (const [gradeId, value] of gradeToValue) {
    const gradeKey = `template_assignment:grade:${gradeId}`;
    const [existing]: any = await queryInterface.sequelize.query(
      `SELECT \`key\` FROM settings WHERE \`key\` = ?`,
      { replacements: [gradeKey] }
    );
    if (existing.length === 0) {
      await queryInterface.sequelize.query(
        `INSERT INTO settings (\`key\`, \`value\`, \`createdAt\`, \`updatedAt\`) VALUES (?, ?, NOW(), NOW())`,
        { replacements: [gradeKey, value] }
      );
    }
  }

  // Delete all legacy per-section assignment keys.
  await queryInterface.sequelize.query(`
    DELETE FROM settings
    WHERE \`key\` LIKE 'template_assignment:grade:%:section:%'
  `);
}

export async function down(queryInterface: QueryInterface) {
  // No-op: per-section assignments cannot be reconstructed from per-grade ones.
  // The per-grade assignments remain as-is.
}
