import sequelize from '@/config/database';
import '@/models/index';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión SQLite establecida.');
    await sequelize.sync({ force: true });
    console.log('✅ Tablas SQLite sincronizadas (force: true).');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    try {
      await sequelize.close();
    } catch {
      /* ignore */
    }
  }
})();
