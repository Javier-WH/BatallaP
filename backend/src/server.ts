import app, { sessionStore } from './app';
import express from 'express';
import sequelize from '@/config/database';
import '@/models/index'; // Register models
import dotenv from 'dotenv';
import path from 'path';
import MigrationRunner from '@/config/migrationRunner';

dotenv.config();

const PORT = process.env.PORT || 3000;

interface StartupError {
  name?: string;
  message?: string;
  parent?: {
    code?: string;
    errno?: number;
    address?: string;
    port?: number;
  };
  original?: {
    code?: string;
    errno?: number;
    address?: string;
    port?: number;
  };
}

const getDatabaseStartupMessage = (error: StartupError): string => {
  const code = error?.original?.code || error?.parent?.code;
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '3306';
  const dbName = process.env.DB_NAME || 'bp';

  if (code === 'ECONNREFUSED') {
    return [
      '❌ No se pudo conectar a MySQL: conexión rechazada.',
      `   - Verifica que MySQL esté encendido en ${host}:${port}.`,
      `   - Verifica las credenciales de la base de datos \`${dbName}\` en backend/.env.`,
      '   - Luego reinicia el backend con: npm run dev:backend'
    ].join('\n');
  }

  if (code === 'ENOTFOUND') {
    return [
      '❌ No se pudo resolver el host de MySQL.',
      `   - Revisa DB_HOST en backend/.env (valor actual: ${host}).`
    ].join('\n');
  }

  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return [
      '❌ Credenciales inválidas para conectar a MySQL.',
      '   - Revisa DB_USER y DB_PASS en backend/.env.'
    ].join('\n');
  }

  return [
    '❌ No fue posible iniciar el backend por un error de conexión a la base de datos.',
    `   - Código detectado: ${code || 'desconocido'}`,
    `   - Mensaje: ${error?.message || 'sin detalle'}`
  ].join('\n');
};

// Configurar Express para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));


const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a base de datos establecida.');

    await sessionStore.sync();
    console.log('✅ Tabla de sesiones sincronizada.');

    // Run pending migrations
    const migrationRunner = new MigrationRunner();
    await migrationRunner.runMigrations();

    // Sync models (create tables if not exist)
    // In production, use migrations instead of sync({ force: true/false })
    await sequelize.sync();
    console.log('✅ Modelos sincronizados correctamente.');

    app.listen(PORT, () => {
      console.log(`🚀 Backend iniciado en http://localhost:${PORT}`);
    });
  } catch (error: unknown) {
    const startupError = error as StartupError;
    console.error('\n' + getDatabaseStartupMessage(startupError));
    process.exit(1);
  }
};

startServer();
