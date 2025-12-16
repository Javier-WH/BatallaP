import app from './app';
import sequelize from '@/config/database';
import dotenv from 'dotenv';
import authRoutes from '@/routes/authRoutes';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Routes
app.use('/api/auth', authRoutes);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Sync models (create tables if not exist)
    // In production, use migrations instead of sync({ force: true/false })
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

startServer();
