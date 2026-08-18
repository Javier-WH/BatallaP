import app, { sessionStore } from './app';
import express from 'express';
import sequelize from '@/config/database';
import '@/models/index'; // Register models
import { EvaluationCatalog } from '@/models/index';
import dotenv from 'dotenv';
import path from 'path';
import MigrationRunner from '@/config/migrationRunner';

dotenv.config();

const PORT = process.env.PORT || 3000;

const DEFAULT_CATALOGS: { type: 'tecnica' | 'instrumento' | 'estrategia'; name: string }[] = [
  // Técnicas
  { type: 'tecnica', name: 'Observación' },
  { type: 'tecnica', name: 'Entrevista' },
  { type: 'tecnica', name: 'Encuesta' },
  { type: 'tecnica', name: 'Prueba escrita' },
  { type: 'tecnica', name: 'Prueba oral' },
  { type: 'tecnica', name: 'Exposición' },
  { type: 'tecnica', name: 'Defensa oral' },
  { type: 'tecnica', name: 'Dramatización' },
  { type: 'tecnica', name: 'Debate' },
  { type: 'tecnica', name: 'Intercambio oral' },
  { type: 'tecnica', name: 'Revisión del cuaderno' },
  // Instrumentos
  { type: 'instrumento', name: 'Lista de cotejo' },
  { type: 'instrumento', name: 'Escala de estimación' },
  { type: 'instrumento', name: 'Rúbrica' },
  { type: 'instrumento', name: 'Cuestionario' },
  { type: 'instrumento', name: 'Guía de observación' },
  { type: 'instrumento', name: 'Registro anecdótico' },
  { type: 'instrumento', name: 'Portafolio' },
  { type: 'instrumento', name: 'Ficha de evaluación' },
  { type: 'instrumento', name: 'Examen' },
  { type: 'instrumento', name: 'Prueba escrita' },
  // Estrategias
  { type: 'estrategia', name: 'Mapa conceptual' },
  { type: 'estrategia', name: 'Cuadro comparativo' },
  { type: 'estrategia', name: 'Resumen' },
  { type: 'estrategia', name: 'Ensayo' },
  { type: 'estrategia', name: 'Phillips 66' },
  { type: 'estrategia', name: 'Estudio de casos' },
  { type: 'estrategia', name: 'Juego de roles' },
  { type: 'estrategia', name: 'Aprendizaje basado en proyectos' },
  { type: 'estrategia', name: 'Aprendizaje cooperativo' },
  { type: 'estrategia', name: 'Lluvia de ideas' },
  { type: 'estrategia', name: 'Observación y Seguimiento' },
  { type: 'estrategia', name: 'Análisis del Desempeño' },
  { type: 'estrategia', name: 'Interrogatorio' },
  { type: 'estrategia', name: 'Participación de los Estudiantes' },
];

const seedDefaultCatalogs = async () => {
  try {
    for (const item of DEFAULT_CATALOGS) {
      await EvaluationCatalog.findOrCreate({
        where: { type: item.type, name: item.name },
        defaults: { type: item.type, name: item.name },
      });
    }
    console.log('✅ Catálogos de evaluación verificados.');
  } catch (error) {
    console.error('⚠️ Error al seedear catálogos de evaluación:', error);
  }
};

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

    await seedDefaultCatalogs();

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
