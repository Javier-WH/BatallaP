import app from './app';
import express from 'express';
import sequelize from '@/config/database';
import '@/models/index'; // Register models
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Configurar Express para servir archivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));


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
