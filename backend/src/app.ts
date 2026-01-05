import express, { Application } from 'express';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import sequelize from '@/config/database';
import connectSessionSequelize from 'connect-session-sequelize';

dotenv.config();

const SequelizeStore = connectSessionSequelize(session.Store);

const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: 'sessions',
  checkExpirationInterval: 15 * 60 * 1000, // Clean expired sessions every 15 min
  expiration: 1000 * 60 * 60 * 24 // 1 day
});

const app: Application = express();

// Aumentar el límite de tamaño para permitir cargar imágenes más grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true for https
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Sync session store table
sessionStore.sync();

// Import routes
import authRoutes from '@/routes/authRoutes';
import userRoutes from '@/routes/userRoutes';
import academicRoutes from '@/routes/academicRoutes';
import inscriptionRoutes from '@/routes/inscriptionRoutes';
import teacherRoutes from '@/routes/teacherRoutes';
import evaluationRoutes from '@/routes/evaluationRoutes';
import settingRoutes from '@/routes/settingRoutes';
import uploadRoutes from '@/routes/uploadRoutes';
import termRoutes from '@/routes/termRoutes';
import periodClosureRoutes from '@/routes/periodClosureRoutes';
import dashboardRoutes from '@/routes/dashboardRoutes';
import periodOutcomeRoutes from '@/routes/periodOutcomeRoutes';
import residenceRoutes from '@/routes/residenceRoutes';
import locationRoutes from '@/routes/locationRoutes';
import matriculationRoutes from '@/routes/matriculationRoutes';
import studentPreviousSchoolRoutes from '@/routes/studentPreviousSchoolRoutes';
import plantelRoutes from '@/routes/plantelRoutes';
import enrollmentQuestionRoutes from '@/routes/enrollmentQuestionRoutes';
import enrollmentAnswerRoutes from '@/routes/enrollmentAnswerRoutes';
import guardianRoutes from '@/routes/guardianRoutes';
import councilRoutes from '@/routes/councilRoutes';

app.get('/', (req, res) => {
  res.send('API is running...');
});

// Register routes
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
app.use('/api/planteles', plantelRoutes);
app.use('/api/enrollment-questions', enrollmentQuestionRoutes);
app.use('/api/enrollment-answers', enrollmentAnswerRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/council', councilRoutes);
app.use('/api/period-closure', periodClosureRoutes);
app.use('/api/periods', periodOutcomeRoutes);
app.use('/api/dashboard', dashboardRoutes);

export default app;
