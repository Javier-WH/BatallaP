import { QueryInterface, QueryTypes } from 'sequelize';

/**
 * Converts the database and every table that is not yet utf8mb4 to
 * utf8mb4 / utf8mb4_unicode_ci.
 *
 * Tables were created with the server's default charset; on hosts where that
 * default is latin1, any character outside it (emoji, zero-width spaces pasted
 * from ChatGPT/Word, ≤ ≥ →, Greek letters…) makes the INSERT fail with
 * "Incorrect string value". latin1 data (accents, ñ) converts losslessly.
 *
 * Tolerant: each table is converted independently; a failure is logged and the
 * remaining tables continue, so a single problematic table never blocks the
 * server from starting. Tables already in utf8mb4 are skipped (idempotent).
 * No-op on SQLite.
 */
const CHARSET = 'utf8mb4';
const COLLATION = 'utf8mb4_unicode_ci';

export async function up(queryInterface: QueryInterface): Promise<void> {
  const sequelize = queryInterface.sequelize;
  if (sequelize.getDialect() === 'sqlite') return;

  const dbName = sequelize.getDatabaseName();

  try {
    await sequelize.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET ${CHARSET} COLLATE ${COLLATION}`);
  } catch (error: any) {
    console.warn(`   ⚠️ No se pudo cambiar el charset por defecto de la base de datos: ${error.message}`);
  }

  const tables = await sequelize.query<{ name: string; collation: string | null }>(
    `SELECT TABLE_NAME AS name, TABLE_COLLATION AS collation
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = :dbName AND TABLE_TYPE = 'BASE TABLE'`,
    { type: QueryTypes.SELECT, replacements: { dbName } }
  );

  // A table's default collation can be utf8mb4 while individual columns are not.
  const columns = await sequelize.query<{ name: string }>(
    `SELECT DISTINCT TABLE_NAME AS name
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = :dbName AND CHARACTER_SET_NAME IS NOT NULL AND CHARACTER_SET_NAME <> :charset`,
    { type: QueryTypes.SELECT, replacements: { dbName, charset: CHARSET } }
  );
  const tablesWithLegacyColumns = new Set(columns.map(c => c.name));

  const pending = tables.filter(t => !(t.collation ?? '').startsWith(CHARSET) || tablesWithLegacyColumns.has(t.name));
  if (pending.length === 0) {
    console.log('   ✅ Todas las tablas ya están en utf8mb4');
    return;
  }

  const failed: string[] = [];
  // A transaction pins a single connection so the session settings below apply
  // to every ALTER. DDL commits implicitly; the transaction is only used for
  // the connection.
  //  - FOREIGN_KEY_CHECKS=0: string FK columns would otherwise block the change.
  //  - sql_mode='': CONVERT rebuilds the table, and strict mode rejects legacy
  //    rows with '0000-00-00 00:00:00' dates, aborting the whole conversion.
  await sequelize.transaction(async (transaction) => {
    await sequelize.query('SET @prev_sql_mode = @@SESSION.sql_mode', { transaction });
    await sequelize.query(`SET SESSION sql_mode = ''`, { transaction });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0', { transaction });
    try {
      for (const { name } of pending) {
        try {
          await sequelize.query(`ALTER TABLE \`${name}\` CONVERT TO CHARACTER SET ${CHARSET} COLLATE ${COLLATION}`, { transaction });
          console.log(`   ✅ ${name} → utf8mb4`);
        } catch (error: any) {
          failed.push(name);
          console.error(`   ❌ ${name}: ${error.message}`);
        }
      }
    } finally {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1', { transaction });
      await sequelize.query('SET SESSION sql_mode = @prev_sql_mode', { transaction });
    }
  });

  console.log(`   utf8mb4: ${pending.length - failed.length}/${pending.length} tabla(s) convertidas` +
    (failed.length ? ` — fallaron: ${failed.join(', ')}` : ''));
}

export async function down(): Promise<void> {
  // Converting back could lose characters that only exist in utf8mb4.
}
