import sequelize from '@/config/database';
import { QueryTypes } from 'sequelize';

(async () => {
  await sequelize.authenticate();

  // 1. Expand the ENUM to include 'estrategia'
  try {
    await sequelize.query(
      "ALTER TABLE evaluation_catalogs MODIFY COLUMN type ENUM('tecnica','instrumento','estrategia') NOT NULL"
    );
    console.log('ENUM expanded with estrategia');
  } catch (e) {
    console.log('ENUM alter skipped:', (e as Error).message);
  }

  // 2. Add estrategiaId column to evaluation_plans
  try {
    await sequelize.query(
      "ALTER TABLE evaluation_plans ADD COLUMN estrategiaId INT NULL DEFAULT NULL"
    );
    console.log('Column estrategiaId added to evaluation_plans');
  } catch (e) {
    console.log('Column add skipped (may already exist):', (e as Error).message);
  }

  // 3. Migrate existing description values to evaluation_catalogs
  const rows: any = await sequelize.query(
    "SELECT DISTINCT description FROM evaluation_plans WHERE description IS NOT NULL AND description != '' AND estrategiaId IS NULL",
    { type: QueryTypes.SELECT }
  );
  for (const row of rows as any[]) {
    const name = row.description;
    const existing: any = await sequelize.query(
      "SELECT id FROM evaluation_catalogs WHERE type='estrategia' AND name=?",
      { replacements: [name], type: QueryTypes.SELECT }
    );
    let catalogId: number;
    if (existing.length > 0) {
      catalogId = existing[0].id;
    } else {
      const result: any = await sequelize.query(
        "INSERT INTO evaluation_catalogs (type, name) VALUES ('estrategia', ?)",
        { replacements: [name], type: QueryTypes.INSERT }
      );
      catalogId = result[0];
    }
    await sequelize.query(
      "UPDATE evaluation_plans SET estrategiaId=? WHERE description=?",
      { replacements: [catalogId, name] }
    );
    console.log(`Migrated estrategia "${name}" -> ID ${catalogId}`);
  }

  console.log('Migration complete');
  await sequelize.close();
})();
