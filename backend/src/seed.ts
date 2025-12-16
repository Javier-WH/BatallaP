import sequelize from '@/config/database';
import User from '@/models/User';
import dotenv from 'dotenv';

dotenv.config();

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Ensure table exists
    await sequelize.sync();

    const existingUser = await User.findOne({ where: { username: 'Javier' } });

    if (existingUser) {
      console.log('User Javier already exists, skipping.');
    } else {
      await User.create({
        username: 'Javier',
        password: '123456', // Will be hashed by hooks
        firstName: 'Javier',
        lastName: 'Admin',
        role: 'admin',
      });
      console.log('User Javier created successfully.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seed();
