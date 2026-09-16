"use strict";
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
const database_1 = __importDefault(require("./config/database.js"));
const index_1 = require("./models/index.js");
const Term_1 = __importDefault(require("./models/Term.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.ENV_FILE || '.env' });
const seed = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.authenticate();
        console.log('Database connected.');
        // Sync database to ensure tables exist
        yield database_1.default.sync();
        // 1. Create Roles
        const roles = ['Master', 'Administrador', 'Director', 'Control de Estudios', 'Profesor', 'Representante', 'Alumno'];
        for (const roleName of roles) {
            const exists = yield index_1.Role.findOne({ where: { name: roleName } });
            if (!exists) {
                yield index_1.Role.create({ name: roleName });
                console.log(`Role ${roleName} created.`);
            }
        }
        // 2. Create default School Periods
        const defaultPeriods = [
            { period: '2024-2025', name: 'Af1o Escolar 2024-2025' },
            { period: '2025-2026', name: 'Af1o Escolar 2025-2026' }
        ];
        for (const p of defaultPeriods) {
            const existing = yield index_1.SchoolPeriod.findOne({ where: { period: p.period } });
            if (!existing) {
                const [start, end] = p.period.split('-').map(v => parseInt(v, 10));
                yield index_1.SchoolPeriod.create({
                    period: p.period,
                    name: p.name,
                    startYear: start,
                    endYear: end,
                    status: p.period === '2025-2026' ? 'activo' : 'historico'
                });
                console.log(`School period ${p.period} created.`);
            }
        }
        // 3. Create default Terms for active period
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (activePeriod) {
            const defaultTerms = [
                { name: 'Primer Lapso', order: 1, isBlocked: false, isActive: true },
                { name: 'Segundo Lapso', order: 2, isBlocked: false, isActive: false },
                { name: 'Tercer Lapso', order: 3, isBlocked: false, isActive: false }
            ];
            for (const termData of defaultTerms) {
                const exists = yield Term_1.default.findOne({
                    where: {
                        schoolPeriodId: activePeriod.id,
                        order: termData.order
                    }
                });
                if (!exists) {
                    yield Term_1.default.create(Object.assign(Object.assign({}, termData), { schoolPeriodId: activePeriod.id }));
                    console.log(`Term "${termData.name}" created for period ${activePeriod.name}.`);
                }
            }
        }
        // 4. Create Subjects - Venezuelan High School Curriculum (1st to 5th year)
        const subjects = [
            // Materias comunes a todos los años
            'Castellano y Literatura',
            'Inglés',
            'Matemática',
            'Física',
            'Química',
            'Biología',
            'Historia de Venezuela',
            'Geografía de Venezuela',
            'Educación Física y Deporte',
            'Educación Artística',
            'Orientación y Convivencia',
            'Instrucción Premilitar',
            // Materias específicas de Ciencias
            'Ciencias de la Tierra',
            'Biología Celular',
            'Matemática Avanzada',
            'Física Avanzada',
            'Química Avanzada',
            // Materias específicas de Humanidades
            'Historia Universal',
            'Geografía General',
            'Filosofía',
            'Psicología',
            'Sociología',
            'Educación para la Salud',
            // Materias electivas y complementarias
            'Informática',
            'Dibujo Técnico',
            'Educación para el Trabajo',
            'Formación Ciudadana',
            'Patrimonio Cultural',
            'Educación Ambiental',
            'Estadística',
            'Cátedra Bolivariana',
            'Memoria, Territorio y Ciudadanía',
            'Artes Gráficas',
            'Ortografía',
            'Agrupación de Desfiles'
        ];
        for (const subjectName of subjects) {
            const exists = yield index_1.Subject.findOne({ where: { name: subjectName } });
            if (!exists) {
                yield index_1.Subject.create({ name: subjectName });
                console.log(`Subject "${subjectName}" created.`);
            }
        }
        // 4. Create default Grades
        const defaultGrades = [
            { name: 'Primer año', isDiversified: false, order: 1 },
            { name: 'Segundo año', isDiversified: false, order: 2 },
            { name: 'Tercer año', isDiversified: false, order: 3 },
            { name: 'Cuarto año', isDiversified: true, order: 4 },
            { name: 'Quinto año', isDiversified: true, order: 5 }
        ];
        for (const gradeData of defaultGrades) {
            const exists = yield index_1.Grade.findOne({ where: { name: gradeData.name } });
            if (!exists) {
                yield index_1.Grade.create(gradeData);
                console.log(`Grade "${gradeData.name}" created.`);
            }
        }
        // 5. Create default Section
        const defaultSection = 'Sección A';
        const sectionExists = yield index_1.Section.findOne({ where: { name: defaultSection } });
        if (!sectionExists) {
            yield index_1.Section.create({ name: defaultSection });
            console.log(`Section "${defaultSection}" created.`);
        }
        // 6. Create default Specializations (Menciones)
        const defaultSpecializations = ['Ciencias', 'Humanidades'];
        for (const specName of defaultSpecializations) {
            const exists = yield index_1.Specialization.findOne({ where: { name: specName } });
            if (!exists) {
                yield index_1.Specialization.create({ name: specName });
                console.log(`Specialization "${specName}" created.`);
            }
        }
        // 7. Seed Planteles from JSON file
        console.log('🌱 Seeding planteles...');
        const existingPlantelesCount = yield index_1.Plantel.count();
        if (existingPlantelesCount === 0) {
            try {
                const plantelesPath = path_1.default.resolve(process.cwd(), 'src/assets/planteles.json');
                const rawData = fs_1.default.readFileSync(plantelesPath, 'utf-8');
                const plantelesData = JSON.parse(rawData);
                console.log(`📊 Found ${plantelesData.length} planteles to seed`);
                // Insert in batches to avoid memory issues
                const batchSize = 1000;
                let totalInserted = 0;
                for (let i = 0; i < plantelesData.length; i += batchSize) {
                    const batch = plantelesData.slice(i, i + batchSize);
                    const plantelesToInsert = batch.map((plantel) => ({
                        code: plantel.deaCode,
                        name: plantel.name,
                        state: plantel.state,
                        dependency: plantel.dependency,
                        municipality: plantel.municipality || null,
                        parish: plantel.parish || null
                    }));
                    yield index_1.Plantel.bulkCreate(plantelesToInsert, {
                        ignoreDuplicates: true,
                        validate: true
                    });
                    totalInserted += batch.length;
                    console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} inserted (${totalInserted}/${plantelesData.length})`);
                }
                console.log(`🎉 Successfully seeded ${totalInserted} planteles!`);
            }
            catch (error) {
                console.error('❌ Error seeding planteles:', error);
            }
        }
        else {
            console.log(`ℹ️  Planteles already seeded (${existingPlantelesCount} records found)`);
        }
        // 6. Create User Javier
        let user = yield index_1.User.findOne({ where: { username: 'Javier' } });
        if (!user) {
            user = yield index_1.User.create({
                username: 'Javier',
                password: '123456',
            });
            console.log('User Javier created.');
            // 3. Create Person for Javier
            const person = yield index_1.Person.create({
                firstName: 'Javier',
                lastName: 'Maestro',
                documentType: 'Venezolano',
                document: 'V-12345678',
                gender: 'M',
                birthdate: new Date('1990-01-01'),
                userId: user.id
            });
            console.log('Person profile for Javier created.');
            // 4. Assign all Roles to Javier
            const targetRoles = roles;
            for (const roleName of targetRoles) {
                const role = yield index_1.Role.findOne({ where: { name: roleName } });
                if (role) {
                    const hasRole = yield index_1.PersonRole.findOne({ where: { personId: person.id, roleId: role.id } });
                    if (!hasRole) {
                        yield index_1.PersonRole.create({
                            personId: person.id,
                            roleId: role.id
                        });
                        console.log(`Role ${roleName} assigned to Javier.`);
                    }
                    else {
                        console.log(`User Javier already has ${roleName} role.`);
                    }
                }
            }
        }
        else {
            console.log('User Javier already exists, checking profile and permissions...');
            // Ensure Person exists
            let person = yield index_1.Person.findOne({ where: { userId: user.id } });
            if (!person) {
                person = yield index_1.Person.create({
                    firstName: 'Javier',
                    lastName: 'Maestro',
                    documentType: 'Venezolano',
                    document: '12345678',
                    gender: 'M',
                    birthdate: new Date('1990-01-01'),
                    userId: user.id
                });
                console.log('Person profile for existing Javier created.');
            }
            // Ensure all Roles for Javier
            const targetRoles = roles;
            for (const roleName of targetRoles) {
                const role = yield index_1.Role.findOne({ where: { name: roleName } });
                if (role) {
                    const hasRole = yield index_1.PersonRole.findOne({ where: { personId: person.id, roleId: role.id } });
                    if (!hasRole) {
                        yield index_1.PersonRole.create({
                            personId: person.id,
                            roleId: role.id
                        });
                        console.log(`Role ${roleName} assigned to existing Javier.`);
                    }
                    else {
                        console.log(`User Javier already has ${roleName} role.`);
                    }
                }
            }
        }
        // Seed default evaluation catalogs
        const defaultCatalogs = [
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
        for (const item of defaultCatalogs) {
            yield index_1.EvaluationCatalog.findOrCreate({
                where: { type: item.type, name: item.name },
                defaults: { type: item.type, name: item.name },
            });
        }
        console.log('Evaluation catalogs seeded.');
        // Seed default subject presets
        const emgItems = [
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
        yield index_1.SubjectPreset.findOrCreate({
            where: { name: 'EMG 31059' },
            defaults: {
                name: 'EMG 31059',
                description: 'Educación Media General — Plan de estudio 31059 (1ro a 5to año)',
                items: emgItems,
                isSystem: true,
            },
        });
        console.log('Subject presets seeded.');
    }
    catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
    finally {
        try {
            yield database_1.default.close();
        }
        catch (closeError) {
            console.error('Error closing database connection:', closeError);
        }
    }
});
seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
