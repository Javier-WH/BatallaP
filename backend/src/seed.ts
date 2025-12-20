import sequelize from '@/config/database';
import { User, Person, Role, PersonRole, SchoolPeriod, Subject, Grade, Section, Specialization } from '@/models/index';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync database to ensure tables exist
    await sequelize.sync();

    // 1. Create Roles
    const roles = ['Master', 'Admin', 'StudyControl', 'Teacher', 'Tutor', 'Student'];
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
          isActive: p.period === '2025-2026'
        });
        console.log(`School period ${p.period} created.`);
      }
    }

    // 3. Create Subjects - Venezuelan High School Curriculum (1st to 5th year)
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
      'Memoria, Territorio y Ciudadanía'
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
          document: 'V-12345678',
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
