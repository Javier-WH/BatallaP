import express, { Application } from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'path';
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
  origin: process.env.CORS_ORIGIN || true,
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

// Import routes
import authRoutes from '@/routes/authRoutes';
import userRoutes from '@/routes/userRoutes';
import academicRoutes from '@/routes/academicRoutes';
import inscriptionRoutes from '@/routes/inscriptionRoutes';
import teacherRoutes from '@/routes/teacherRoutes';
import evaluationRoutes from '@/routes/evaluationRoutes';
import thematicComponentRoutes from '@/routes/thematicComponentRoutes';
import settingRoutes from '@/routes/settingRoutes';
import uploadRoutes from '@/routes/uploadRoutes';
import termRoutes from '@/routes/termRoutes';
import termSectionClosureRoutes from '@/routes/termSectionClosureRoutes';
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
import bulkEnrollmentRoutes from '@/routes/bulkEnrollmentRoutes';
import guardianRoutes from '@/routes/guardianRoutes';
import councilRoutes from '@/routes/councilRoutes';
import performanceSummaryRoutes from '@/routes/performanceSummaryRoutes';
import certifiedGradesRoutes from '@/routes/certifiedGradesRoutes';
import templateRoutes from '@/routes/templateRoutes';
import gradeEditPermissionRoutes from '@/routes/gradeEditPermissionRoutes';
import enrollmentReportRoutes from '@/routes/enrollmentReportRoutes';
import dashboardContentRoutes from '@/routes/dashboardContentRoutes';
import healthRoutes from '@/routes/healthRoutes';
import revisionPeriodRoutes from '@/routes/revisionPeriodRoutes';
import revisionGradeRoutes from '@/routes/revisionGradeRoutes';
import externalGradeRoutes from '@/routes/externalGradeRoutes';
import evaluationCatalogRoutes from '@/routes/evaluationCatalogRoutes';
import sectionGuideRoutes from '@/routes/sectionGuideRoutes';
import historicalGradesRoutes from '@/routes/historicalGradesRoutes';
import observationRoutes from '@/routes/observationRoutes';
import subjectPresetRoutes from '@/routes/subjectPresetRoutes';
import structurePresetRoutes from '@/routes/structurePresetRoutes';
import pendingSubjectRoutes from '@/routes/pendingSubjectRoutes';
import paymentsRoutes from '@/routes/paymentsRoutes';
import ledgerRoutes from '@/routes/ledgerRoutes';
import constanciaRoutes from '@/routes/constanciaRoutes';
import teacherAvailabilityRoutes from '@/routes/teacherAvailabilityRoutes';
import scheduleRoutes from '@/routes/scheduleRoutes';
import scheduleExceptionRoutes from '@/routes/scheduleExceptionRoutes';
import classroomAssignmentRoutes from '@/routes/classroomAssignmentRoutes';
import roomBookingRoutes from '@/routes/roomBookingRoutes';
import diarioRoutes from '@/routes/diarioRoutes';

app.get('/health', (req, res) => {
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
app.use('/api/thematic-components', thematicComponentRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/terms', termRoutes);
app.use('/api/terms', termSectionClosureRoutes);
app.use('/api/residences', residenceRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/matriculations', matriculationRoutes);
app.use('/api/planteles', plantelRoutes);
app.use('/api/enrollment-questions', enrollmentQuestionRoutes);
app.use('/api/enrollment-answers', enrollmentAnswerRoutes);
app.use('/api/inscriptions/bulk', bulkEnrollmentRoutes);
app.use('/api/guardians', guardianRoutes);
app.use('/api/council', councilRoutes);
app.use('/api/performance-summary', performanceSummaryRoutes);
app.use('/api/certified-grades', certifiedGradesRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/grade-edit-permissions', gradeEditPermissionRoutes);
app.use('/api/period-closure', periodClosureRoutes);
app.use('/api/periods', periodOutcomeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/enrollment-reports', enrollmentReportRoutes);
app.use('/api/dashboard-content', dashboardContentRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/revision-periods', revisionPeriodRoutes);
app.use('/api/revision-grades', revisionGradeRoutes);
app.use('/api/external-grades', externalGradeRoutes);
app.use('/api/evaluation/catalogs', evaluationCatalogRoutes);
app.use('/api/section-guides', sectionGuideRoutes);
app.use('/api/historical-grades', historicalGradesRoutes);
app.use('/api/observations', observationRoutes);
app.use('/api/subject-presets', subjectPresetRoutes);
app.use('/api/structure-presets', structurePresetRoutes);
app.use('/api/pending-subjects', pendingSubjectRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/constancias', constanciaRoutes);
app.use('/api/teacher-availability', teacherAvailabilityRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/schedule-exceptions', scheduleExceptionRoutes);
app.use('/api/classroom-assignments', classroomAssignmentRoutes);
app.use('/api/room-bookings', roomBookingRoutes);
app.use('/api/diarios', diarioRoutes);

// Serve uploaded files (logo, documents, dashboard images)
const uploadsDir = path.join(__dirname, '..', 'public');
app.use('/uploads', express.static(path.join(uploadsDir, 'uploads')));

// Serve frontend static files (production build)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

// SPA fallback: serve index.html for any non-API route (React Router)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
    return res.sendFile(path.join(frontendDist, 'index.html'));
  }
  next();
});

export { sessionStore };
export default app;
