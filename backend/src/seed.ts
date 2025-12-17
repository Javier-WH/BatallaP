import sequelize from '@/config/database';
import { User, Person, Role, PersonRole } from '@/models/index';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync database to ensure tables exist
    await sequelize.sync({ alter: true });

    // 1. Create Roles
    const roles = ['Master', 'Admin', 'Teacher', 'Tutor', 'Student'];
    for (const roleName of roles) {
      const exists = await Role.findOne({ where: { name: roleName as any } });
      if (!exists) {
        await Role.create({ name: roleName as any });
        console.log(`Role ${roleName} created.`);
      }
    }

    // 2. Create User Javier
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

      // 4. Assign Roles (Master, Admin, Teacher)
      const targetRoles = ['Master', 'Admin', 'Teacher'];

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

      // Ensure Roles (Master, Admin, Teacher)
      const targetRoles = ['Master', 'Admin', 'Teacher'];

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

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seed();
