import app from './app';
import express from 'express';
import sequelize from '@/config/database';
import '@/models/index'; // Register models
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from '@/routes/authRoutes';
import userRoutes from '@/routes/userRoutes';
import academicRoutes from '@/routes/academicRoutes';
import inscriptionRoutes from '@/routes/inscriptionRoutes';
import teacherRoutes from '@/routes/teacherRoutes';
import evaluationRoutes from '@/routes/evaluationRoutes';
import settingRoutes from '@/routes/settingRoutes';
import uploadRoutes from '@/routes/uploadRoutes';
import termRoutes from '@/routes/termRoutes';
import residenceRoutes from '@/routes/residenceRoutes';
import locationRoutes from '@/routes/locationRoutes';
import matriculationRoutes from '@/routes/matriculationRoutes';
import studentPreviousSchoolRoutes from '@/routes/studentPreviousSchoolRoutes';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Configurar Express para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/users/:personId/student-previous-schools', studentPreviousSchoolRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/inscriptions', inscriptionRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/evaluation', evaluationRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/residences', residenceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/matriculations', matriculationRoutes);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Sync models (create tables if not exist)
    // In production, use migrations instead of sync({ force: true/false })
    await sequelize.sync();
    console.log('All models were synchronized successfully.');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

startServer();
