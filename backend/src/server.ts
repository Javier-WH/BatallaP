import app, { sessionStore } from './app';
import express from 'express';
import os from 'os';
import sequelize from '@/config/database';
import '@/models/index'; // Register models
import { EvaluationCatalog, SubjectPreset, StructurePreset } from '@/models/index';
import dotenv from 'dotenv';
import path from 'path';
import MigrationRunner from '@/config/migrationRunner';
import cron from 'node-cron';
import { scrapeBcvRates } from '@/services/bcvScraperService';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const PORT = Number(process.env.PORT) || 3000;

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

const EMG_31059_ITEMS = [
  { name: 'Castellano', abbreviation: 'CA' },
  { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
  { name: 'Matemáticas', abbreviation: 'MA' },
  { name: 'Educación Física', abbreviation: 'EF' },
  { name: 'Arte y Patrimonio', abbreviation: 'AP' },
  { name: 'Ciencias Naturales', abbreviation: 'CN' },
  { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
  { name: 'Orientación y Convivencia', abbreviation: 'OC' },
  { name: 'Física', abbreviation: 'FI' },
  { name: 'Química', abbreviation: 'QU' },
  { name: 'Biología', abbreviation: 'BI' },
  { name: 'Formación para la Soberanía Nacional', abbreviation: 'FSN' },
  { name: 'Ciencias de La Tierra', abbreviation: 'CT' },
];

const seedDefaultSubjectPresets = async () => {
  try {
    await SubjectPreset.findOrCreate({
      where: { name: 'EMG 31059' },
      defaults: {
        name: 'EMG 31059',
        description: 'Educación Media General — Plan de estudio 31059 (1ro a 5to año)',
        items: EMG_31059_ITEMS,
        isSystem: true,
      },
    });
    console.log('✅ Presets de materias verificados.');
  } catch (error) {
    console.error('⚠️ Error al seedear presets de materias:', error);
  }
};

const EMG_31059_STRUCTURE = [
  {
    name: 'Primer Año',
    subjects: [
      { name: 'Castellano', abbreviation: 'CA' },
      { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
      { name: 'Matemáticas', abbreviation: 'MA' },
      { name: 'Educación Física', abbreviation: 'EF' },
      { name: 'Arte y Patrimonio', abbreviation: 'AP' },
      { name: 'Ciencias Naturales', abbreviation: 'CN' },
      { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
      { name: 'Orientación y Convivencia', abbreviation: 'OC' },
    ],
  },
  {
    name: 'Segundo Año',
    subjects: [
      { name: 'Castellano', abbreviation: 'CA' },
      { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
      { name: 'Matemáticas', abbreviation: 'MA' },
      { name: 'Educación Física', abbreviation: 'EF' },
      { name: 'Arte y Patrimonio', abbreviation: 'AP' },
      { name: 'Ciencias Naturales', abbreviation: 'CN' },
      { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
      { name: 'Orientación y Convivencia', abbreviation: 'OC' },
    ],
  },
  {
    name: 'Tercer Año',
    subjects: [
      { name: 'Castellano', abbreviation: 'CA' },
      { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
      { name: 'Matemáticas', abbreviation: 'MA' },
      { name: 'Educación Física', abbreviation: 'EF' },
      { name: 'Física', abbreviation: 'FI' },
      { name: 'Química', abbreviation: 'QU' },
      { name: 'Biología', abbreviation: 'BI' },
      { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
      { name: 'Orientación y Convivencia', abbreviation: 'OC' },
    ],
  },
  {
    name: 'Cuarto Año',
    subjects: [
      { name: 'Castellano', abbreviation: 'CA' },
      { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
      { name: 'Matemáticas', abbreviation: 'MA' },
      { name: 'Educación Física', abbreviation: 'EF' },
      { name: 'Física', abbreviation: 'FI' },
      { name: 'Química', abbreviation: 'QU' },
      { name: 'Biología', abbreviation: 'BI' },
      { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
      { name: 'Formación para la Soberanía Nacional', abbreviation: 'FSN' },
      { name: 'Orientación y Convivencia', abbreviation: 'OC' },
    ],
  },
  {
    name: 'Quinto Año',
    subjects: [
      { name: 'Castellano', abbreviation: 'CA' },
      { name: 'Inglés y Otras Lenguas Extranjeras', abbreviation: 'ILE' },
      { name: 'Matemáticas', abbreviation: 'MA' },
      { name: 'Educación Física', abbreviation: 'EF' },
      { name: 'Física', abbreviation: 'FI' },
      { name: 'Química', abbreviation: 'QU' },
      { name: 'Biología', abbreviation: 'BI' },
      { name: 'Ciencias de La Tierra', abbreviation: 'CT' },
      { name: 'Geografía, Historia y Ciudadanía', abbreviation: 'GHC' },
      { name: 'Formación para la Soberanía Nacional', abbreviation: 'FSN' },
      { name: 'Orientación y Convivencia', abbreviation: 'OC' },
    ],
  },
];

const seedDefaultStructurePresets = async () => {
  try {
    await StructurePreset.findOrCreate({
      where: { name: 'EMG 31059' },
      defaults: {
        name: 'EMG 31059',
        description: 'Educación Media General — Estructura completa 31059 (1ro a 5to año)',
        grades: EMG_31059_STRUCTURE,
        isSystem: true,
      },
    });
    console.log('✅ Presets de estructura verificados.');
  } catch (error) {
    console.error('⚠️ Error al seedear presets de estructura:', error);
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
    await seedDefaultSubjectPresets();
    await seedDefaultStructurePresets();

    app.listen(PORT, '0.0.0.0', () => {
      const nets = os.networkInterfaces();
      const urls = [`http://localhost:${PORT}`];
      for (const iface of Object.values(nets)) {
        if (!iface) continue;
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            urls.push(`http://${addr.address}:${PORT}`);
          }
        }
      }
      console.log(`🚀 Backend iniciado en:`);
      urls.forEach(u => console.log(`   → ${u}`));

      // Cron: scraping BCV a medianoche (hora de Venezuela, UTC-4)
      cron.schedule('0 0 * * *', async () => {
        console.log('[Cron] Ejecutando scraping BCV...');
        try {
          const result = await scrapeBcvRates();
          if (result.success) {
            console.log('[Cron] BCV OK:', result.message);
          } else {
            console.warn('[Cron] BCV falló:', result.message);
          }
        } catch (error) {
          console.error('[Cron] Error scraping BCV:', error);
        }
      }, { timezone: 'America/Caracas' });
      console.log('⏰ Cron de scraping BCV programado (00:00 Venezuela)');

      // Scrape al iniciar: por si el servidor estuvo apagado a medianoche
      setTimeout(async () => {
        console.log('[Startup] Scraping BCV inicial...');
        try {
          const result = await scrapeBcvRates();
          if (result.success) {
            console.log('[Startup] BCV OK:', result.message);
          } else {
            console.warn('[Startup] BCV falló:', result.message);
          }
        } catch (error) {
          console.error('[Startup] Error scraping BCV:', error);
        }
      }, 5000);
    });
  } catch (error: unknown) {
    const startupError = error as StartupError;
    console.error('\n' + getDatabaseStartupMessage(startupError));
    process.exit(1);
  }
};

startServer();
