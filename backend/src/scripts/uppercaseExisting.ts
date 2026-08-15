/**
 * uppercaseExisting.ts
 *
 * Script de normalización: convierte a mayúsculas los campos de texto
 * (nombres, apellidos, etc.) en los registros ya existentes de la BD.
 *
 * Ejecutar una sola vez:
 *   npx ts-node -r tsconfig-paths/register src/scripts/uppercaseExisting.ts
 */
import sequelize from '@/config/database';

const updates: Array<{ table: string; sets: string[] }> = [
  {
    table: 'people',
    sets: [
      "firstName = UPPER(TRIM(firstName))",
      "lastName = UPPER(TRIM(lastName))",
      "pathology = UPPER(TRIM(pathology))",
      "livingWith = UPPER(TRIM(livingWith))",
    ],
  },
  {
    table: 'guardian_profiles',
    sets: [
      "firstName = UPPER(TRIM(firstName))",
      "lastName = UPPER(TRIM(lastName))",
      "occupation = UPPER(TRIM(occupation))",
      "residenceState = UPPER(TRIM(residenceState))",
      "residenceMunicipality = UPPER(TRIM(residenceMunicipality))",
      "residenceParish = UPPER(TRIM(residenceParish))",
      "address = UPPER(TRIM(address))",
    ],
  },
  {
    table: 'subjects',
    sets: [
      "name = UPPER(TRIM(name))",
      "abbreviation = UPPER(TRIM(abbreviation))",
    ],
  },
  {
    table: 'subject_groups',
    sets: ["name = UPPER(TRIM(name))"],
  },
  {
    table: 'grades',
    sets: ["name = UPPER(TRIM(name))"],
  },
  {
    table: 'sections',
    sets: ["name = UPPER(TRIM(name))"],
  },
  {
    table: 'specializations',
    sets: ["name = UPPER(TRIM(name))"],
  },
  {
    table: 'planteles',
    sets: [
      "name = UPPER(TRIM(name))",
      "state = UPPER(TRIM(state))",
      "dependency = UPPER(TRIM(dependency))",
      "municipality = UPPER(TRIM(municipality))",
      "parish = UPPER(TRIM(parish))",
    ],
  },
];

async function main() {
  console.log('🔄 Iniciando normalización a mayúsculas...\n');
  await sequelize.authenticate();

  for (const { table, sets } of updates) {
    const setClause = sets.join(', ');
    const sql = `UPDATE \`${table}\` SET ${setClause}`;
    console.log(`  → ${table}`);
    const [result] = await sequelize.query(sql);
    const affected = (result as any).affectedRows ?? (result as any).changedRows ?? '?';
    console.log(`    Filas afectadas: ${affected}`);
  }

  console.log('\n✅ Normalización completada.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
