import sequelize from '@/config/database';
import { User, Person, Role, PersonRole, SchoolPeriod, Subject, Grade, Section, Specialization, Plantel, EvaluationCatalog, SubjectPreset } from '@/models/index';
import Term from '@/models/Term';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync database to ensure tables exist
    await sequelize.sync();

    // 1. Create Roles
    const roles = ['Master', 'Administrador', 'Control de Estudios', 'Profesor', 'Representante', 'Alumno'];
    for (const roleName of roles) {
      const exists = await Role.findOne({ where: { name: roleName as any } });
      if (!exists) {
        await Role.create({ name: roleName as any });
        console.log(`Role ${roleName} created.`);
      }
    }

    // 2. Create default School Periods
    const defaultPeriods = [
      { period: '2024-2025', name: 'Af1o Escolar 2024-2025' },
      { period: '2025-2026', name: 'Af1o Escolar 2025-2026' }
    ];

    for (const p of defaultPeriods) {
      const existing = await SchoolPeriod.findOne({ where: { period: p.period } });
      if (!existing) {
        const [start, end] = p.period.split('-').map(v => parseInt(v, 10));
        await SchoolPeriod.create({
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
    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (activePeriod) {
      const defaultTerms = [
        { name: 'Primer Lapso', order: 1, isBlocked: false },
        { name: 'Segundo Lapso', order: 2, isBlocked: false },
        { name: 'Tercer Lapso', order: 3, isBlocked: false }
      ];

      for (const termData of defaultTerms) {
        const exists = await Term.findOne({
          where: {
            schoolPeriodId: activePeriod.id,
            order: termData.order
          }
        });
        if (!exists) {
          await Term.create({
            ...termData,
            schoolPeriodId: activePeriod.id
          });
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
      const exists = await Subject.findOne({ where: { name: subjectName } });
      if (!exists) {
        await Subject.create({ name: subjectName });
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
      const exists = await Grade.findOne({ where: { name: gradeData.name } });
      if (!exists) {
        await Grade.create(gradeData);
        console.log(`Grade "${gradeData.name}" created.`);
      }
    }

    // 5. Create default Section
    const defaultSection = 'Sección A';
    const sectionExists = await Section.findOne({ where: { name: defaultSection } });
    if (!sectionExists) {
      await Section.create({ name: defaultSection });
      console.log(`Section "${defaultSection}" created.`);
    }

    // 6. Create default Specializations (Menciones)
    const defaultSpecializations = ['Ciencias', 'Humanidades'];
    for (const specName of defaultSpecializations) {
      const exists = await Specialization.findOne({ where: { name: specName } });
      if (!exists) {
        await Specialization.create({ name: specName });
        console.log(`Specialization "${specName}" created.`);
      }
    }

    // 7. Seed Planteles from JSON file
    console.log('🌱 Seeding planteles...');
    const existingPlantelesCount = await Plantel.count();
    if (existingPlantelesCount === 0) {
      try {
        const plantelesPath = path.resolve(process.cwd(), 'src/assets/planteles.json');
        const rawData = fs.readFileSync(plantelesPath, 'utf-8');
        const plantelesData = JSON.parse(rawData);

        console.log(`📊 Found ${plantelesData.length} planteles to seed`);

        // Insert in batches to avoid memory issues
        const batchSize = 1000;
        let totalInserted = 0;

        for (let i = 0; i < plantelesData.length; i += batchSize) {
          const batch = plantelesData.slice(i, i + batchSize);
          const plantelesToInsert = batch.map((plantel: any) => ({
            code: plantel.deaCode,
            name: plantel.name,
            state: plantel.state,
            dependency: plantel.dependency,
            municipality: plantel.municipality || null,
            parish: plantel.parish || null
          }));

          await Plantel.bulkCreate(plantelesToInsert, {
            ignoreDuplicates: true,
            validate: true
          });

          totalInserted += batch.length;
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} inserted (${totalInserted}/${plantelesData.length})`);
        }

        console.log(`🎉 Successfully seeded ${totalInserted} planteles!`);
      } catch (error) {
        console.error('❌ Error seeding planteles:', error);
      }
    } else {
      console.log(`ℹ️  Planteles already seeded (${existingPlantelesCount} records found)`);
    }

    // 6. Create User Javier
    let user = await User.findOne({ where: { username: 'Javier' } });
    if (!user) {
      user = await User.create({
        username: 'Javier',
        password: '123456',
      });
      console.log('User Javier created.');

      // 3. Create Person for Javier
      const person = await Person.create({
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
        const role = await Role.findOne({ where: { name: roleName as any } });
        if (role) {
          const hasRole = await PersonRole.findOne({ where: { personId: person.id, roleId: role.id } });
          if (!hasRole) {
            await PersonRole.create({
              personId: person.id,
              roleId: role.id
            });
            console.log(`Role ${roleName} assigned to Javier.`);
          } else {
            console.log(`User Javier already has ${roleName} role.`);
          }
        }
      }
    } else {
      console.log('User Javier already exists, checking profile and permissions...');

      // Ensure Person exists
      let person = await Person.findOne({ where: { userId: user.id } });
      if (!person) {
        person = await Person.create({
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
        const role = await Role.findOne({ where: { name: roleName as any } });
        if (role) {
          const hasRole = await PersonRole.findOne({ where: { personId: person.id, roleId: role.id } });
          if (!hasRole) {
            await PersonRole.create({
              personId: person.id,
              roleId: role.id
            });
            console.log(`Role ${roleName} assigned to existing Javier.`);
          } else {
            console.log(`User Javier already has ${roleName} role.`);
          }
        }
      }
    }

    // Seed default evaluation catalogs
    const defaultCatalogs: { type: 'tecnica' | 'instrumento' | 'estrategia'; name: string }[] = [
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
      await EvaluationCatalog.findOrCreate({
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
    await SubjectPreset.findOrCreate({
      where: { name: 'EMG 31059' },
      defaults: {
        name: 'EMG 31059',
        description: 'Educación Media General — Plan de estudio 31059 (1ro a 5to año)',
        items: emgItems,
        isSystem: true,
      },
    });
    console.log('Subject presets seeded.');

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    try {
      await sequelize.close();
    } catch (closeError) {
      console.error('Error closing database connection:', closeError);
    }
  }
};

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
