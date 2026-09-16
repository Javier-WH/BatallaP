"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importStar(require("./app"));
const express_1 = __importDefault(require("express"));
const os_1 = __importDefault(require("os"));
const database_1 = __importDefault(require("./config/database.js"));
require("./models/index.js"); // Register models
const index_1 = require("./models/index.js");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const migrationRunner_1 = __importDefault(require("./config/migrationRunner.js"));
const node_cron_1 = __importDefault(require("node-cron"));
const bcvScraperService_1 = require("./services/bcvScraperService.js");
const logger_1 = __importDefault(require("./config/logger.js"));
dotenv_1.default.config({ path: process.env.ENV_FILE || '.env' });
const PORT = Number(process.env.PORT) || 3000;
// Global process error handlers — capture anything not caught by Express
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled Promise Rejection', {
        reason: reason instanceof Error
            ? { name: reason.name, message: reason.message, stack: reason.stack }
            : String(reason),
        promise: String(promise),
    });
});
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught Exception — process will exit', {
        name: error.name,
        message: error.message,
        stack: error.stack,
    });
    // Give the logger time to flush, then exit
    setTimeout(() => process.exit(1), 1000);
});
const DEFAULT_CATALOGS = [
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
const seedDefaultCatalogs = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        for (const item of DEFAULT_CATALOGS) {
            yield index_1.EvaluationCatalog.findOrCreate({
                where: { type: item.type, name: item.name },
                defaults: { type: item.type, name: item.name },
            });
        }
        logger_1.default.info('✅ Catálogos de evaluación verificados.');
    }
    catch (error) {
        logger_1.default.error('⚠️ Error al seedear catálogos de evaluación:', { error });
    }
});
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
const seedDefaultSubjectPresets = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield index_1.SubjectPreset.findOrCreate({
            where: { name: 'EMG 31059' },
            defaults: {
                name: 'EMG 31059',
                description: 'Educación Media General — Plan de estudio 31059 (1ro a 5to año)',
                items: EMG_31059_ITEMS,
                isSystem: true,
            },
        });
        logger_1.default.info('✅ Presets de materias verificados.');
    }
    catch (error) {
        logger_1.default.error('⚠️ Error al seedear presets de materias:', { error });
    }
});
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
const seedDefaultStructurePresets = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield index_1.StructurePreset.findOrCreate({
            where: { name: 'EMG 31059' },
            defaults: {
                name: 'EMG 31059',
                description: 'Educación Media General — Estructura completa 31059 (1ro a 5to año)',
                grades: EMG_31059_STRUCTURE,
                isSystem: true,
            },
        });
        logger_1.default.info('✅ Presets de estructura verificados.');
    }
    catch (error) {
        logger_1.default.error('⚠️ Error al seedear presets de estructura:', { error });
    }
});
const getDatabaseStartupMessage = (error) => {
    var _a, _b;
    const code = ((_a = error === null || error === void 0 ? void 0 : error.original) === null || _a === void 0 ? void 0 : _a.code) || ((_b = error === null || error === void 0 ? void 0 : error.parent) === null || _b === void 0 ? void 0 : _b.code);
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
        `   - Mensaje: ${(error === null || error === void 0 ? void 0 : error.message) || 'sin detalle'}`
    ].join('\n');
};
// Configurar Express para servir archivos estáticos
app_1.default.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../public/uploads')));
const startServer = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.authenticate();
        logger_1.default.info('✅ Conexión a base de datos establecida.');
        yield app_1.sessionStore.sync();
        logger_1.default.info('✅ Tabla de sesiones sincronizada.');
        // Run pending migrations
        const migrationRunner = new migrationRunner_1.default();
        yield migrationRunner.runMigrations();
        // Sync models (create tables if not exist)
        // In production, use migrations instead of sync({ force: true/false })
        yield database_1.default.sync();
        logger_1.default.info('✅ Modelos sincronizados correctamente.');
        yield seedDefaultCatalogs();
        yield seedDefaultSubjectPresets();
        yield seedDefaultStructurePresets();
        app_1.default.listen(PORT, '0.0.0.0', () => {
            const nets = os_1.default.networkInterfaces();
            const urls = [`http://localhost:${PORT}`];
            for (const iface of Object.values(nets)) {
                if (!iface)
                    continue;
                for (const addr of iface) {
                    if (addr.family === 'IPv4' && !addr.internal) {
                        urls.push(`http://${addr.address}:${PORT}`);
                    }
                }
            }
            logger_1.default.info(`🚀 Backend iniciado en:`);
            urls.forEach(u => logger_1.default.info(`   → ${u}`));
            // Cron: scraping BCV a medianoche (hora de Venezuela, UTC-4)
            node_cron_1.default.schedule('0 0 * * *', () => __awaiter(void 0, void 0, void 0, function* () {
                logger_1.default.info('[Cron] Ejecutando scraping BCV...');
                try {
                    const result = yield (0, bcvScraperService_1.scrapeBcvRates)();
                    if (result.success) {
                        logger_1.default.info('[Cron] BCV OK:', { message: result.message });
                    }
                    else {
                        logger_1.default.warn('[Cron] BCV falló:', { message: result.message });
                    }
                }
                catch (error) {
                    logger_1.default.error('[Cron] Error scraping BCV:', { error });
                }
            }), { timezone: 'America/Caracas' });
            logger_1.default.info('⏰ Cron de scraping BCV programado (00:00 Venezuela)');
            // Scrape al iniciar: por si el servidor estuvo apagado a medianoche
            setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                logger_1.default.info('[Startup] Scraping BCV inicial...');
                try {
                    const result = yield (0, bcvScraperService_1.scrapeBcvRates)();
                    if (result.success) {
                        logger_1.default.info('[Startup] BCV OK:', { message: result.message });
                    }
                    else {
                        logger_1.default.warn('[Startup] BCV falló:', { message: result.message });
                    }
                }
                catch (error) {
                    logger_1.default.error('[Startup] Error scraping BCV:', { error });
                }
            }), 5000);
        });
    }
    catch (error) {
        const startupError = error;
        logger_1.default.error('\n' + getDatabaseStartupMessage(startupError));
        process.exit(1);
    }
});
startServer();
