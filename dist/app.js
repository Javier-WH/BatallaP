"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionStore = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
const database_1 = __importDefault(require("./config/database.js"));
const connect_session_sequelize_1 = __importDefault(require("connect-session-sequelize"));
const logger_1 = require("./config/logger.js");
const errorHandlerMiddleware_1 = require("./middlewares/errorHandlerMiddleware.js");
dotenv_1.default.config({ path: process.env.ENV_FILE || '.env' });
const SequelizeStore = (0, connect_session_sequelize_1.default)(express_session_1.default.Store);
const sessionStore = new SequelizeStore({
    db: database_1.default,
    tableName: 'sessions',
    checkExpirationInterval: 15 * 60 * 1000, // Clean expired sessions every 15 min
    expiration: 1000 * 60 * 60 * 24 // 1 day
});
exports.sessionStore = sessionStore;
const app = (0, express_1.default)();
// Disable ETag generation to prevent browsers (especially Opera) from caching
// API responses — the ETag header was causing stale 401 responses to be served
// from cache without hitting the backend.
app.set('etag', false);
// Aumentar el límite de tamaño para permitir cargar imágenes más grandes
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use((0, cookie_parser_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true for https
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));
// HTTP request logging via morgan → winston
app.use((0, morgan_1.default)(':method :url :status :response-time ms - :res[content-length]', { stream: logger_1.stream }));
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes.js"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes.js"));
const academicRoutes_1 = __importDefault(require("./routes/academicRoutes.js"));
const inscriptionRoutes_1 = __importDefault(require("./routes/inscriptionRoutes.js"));
const teacherRoutes_1 = __importDefault(require("./routes/teacherRoutes.js"));
const evaluationRoutes_1 = __importDefault(require("./routes/evaluationRoutes.js"));
const thematicComponentRoutes_1 = __importDefault(require("./routes/thematicComponentRoutes.js"));
const settingRoutes_1 = __importDefault(require("./routes/settingRoutes.js"));
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes.js"));
const termRoutes_1 = __importDefault(require("./routes/termRoutes.js"));
const termSectionClosureRoutes_1 = __importDefault(require("./routes/termSectionClosureRoutes.js"));
const periodClosureRoutes_1 = __importDefault(require("./routes/periodClosureRoutes.js"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes.js"));
const periodOutcomeRoutes_1 = __importDefault(require("./routes/periodOutcomeRoutes.js"));
const residenceRoutes_1 = __importDefault(require("./routes/residenceRoutes.js"));
const locationRoutes_1 = __importDefault(require("./routes/locationRoutes.js"));
const matriculationRoutes_1 = __importDefault(require("./routes/matriculationRoutes.js"));
const studentPreviousSchoolRoutes_1 = __importDefault(require("./routes/studentPreviousSchoolRoutes.js"));
const plantelRoutes_1 = __importDefault(require("./routes/plantelRoutes.js"));
const enrollmentQuestionRoutes_1 = __importDefault(require("./routes/enrollmentQuestionRoutes.js"));
const enrollmentAnswerRoutes_1 = __importDefault(require("./routes/enrollmentAnswerRoutes.js"));
const bulkEnrollmentRoutes_1 = __importDefault(require("./routes/bulkEnrollmentRoutes.js"));
const guardianRoutes_1 = __importDefault(require("./routes/guardianRoutes.js"));
const councilRoutes_1 = __importDefault(require("./routes/councilRoutes.js"));
const performanceSummaryRoutes_1 = __importDefault(require("./routes/performanceSummaryRoutes.js"));
const certifiedGradesRoutes_1 = __importDefault(require("./routes/certifiedGradesRoutes.js"));
const templateRoutes_1 = __importDefault(require("./routes/templateRoutes.js"));
const gradeEditPermissionRoutes_1 = __importDefault(require("./routes/gradeEditPermissionRoutes.js"));
const enrollmentReportRoutes_1 = __importDefault(require("./routes/enrollmentReportRoutes.js"));
const dashboardContentRoutes_1 = __importDefault(require("./routes/dashboardContentRoutes.js"));
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes.js"));
const revisionPeriodRoutes_1 = __importDefault(require("./routes/revisionPeriodRoutes.js"));
const revisionGradeRoutes_1 = __importDefault(require("./routes/revisionGradeRoutes.js"));
const externalGradeRoutes_1 = __importDefault(require("./routes/externalGradeRoutes.js"));
const evaluationCatalogRoutes_1 = __importDefault(require("./routes/evaluationCatalogRoutes.js"));
const sectionGuideRoutes_1 = __importDefault(require("./routes/sectionGuideRoutes.js"));
const historicalGradesRoutes_1 = __importDefault(require("./routes/historicalGradesRoutes.js"));
const observationRoutes_1 = __importDefault(require("./routes/observationRoutes.js"));
const subjectPresetRoutes_1 = __importDefault(require("./routes/subjectPresetRoutes.js"));
const structurePresetRoutes_1 = __importDefault(require("./routes/structurePresetRoutes.js"));
const pendingSubjectRoutes_1 = __importDefault(require("./routes/pendingSubjectRoutes.js"));
const paymentsRoutes_1 = __importDefault(require("./routes/paymentsRoutes.js"));
const ledgerRoutes_1 = __importDefault(require("./routes/ledgerRoutes.js"));
const constanciaRoutes_1 = __importDefault(require("./routes/constanciaRoutes.js"));
const teacherAvailabilityRoutes_1 = __importDefault(require("./routes/teacherAvailabilityRoutes.js"));
const scheduleRoutes_1 = __importDefault(require("./routes/scheduleRoutes.js"));
const scheduleExceptionRoutes_1 = __importDefault(require("./routes/scheduleExceptionRoutes.js"));
const scheduleLinkRoutes_1 = __importDefault(require("./routes/scheduleLinkRoutes.js"));
const classroomAssignmentRoutes_1 = __importDefault(require("./routes/classroomAssignmentRoutes.js"));
const roomBookingRoutes_1 = __importDefault(require("./routes/roomBookingRoutes.js"));
const diarioRoutes_1 = __importDefault(require("./routes/diarioRoutes.js"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes.js"));
const gateRoutes_1 = __importDefault(require("./routes/gateRoutes.js"));
app.get('/health', (req, res) => {
    res.send('API is running...');
});
// Register routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/users/:personId/student-previous-schools', studentPreviousSchoolRoutes_1.default);
app.use('/api/academic', academicRoutes_1.default);
app.use('/api/inscriptions', inscriptionRoutes_1.default);
app.use('/api/teachers', teacherRoutes_1.default);
app.use('/api/evaluation', evaluationRoutes_1.default);
app.use('/api/thematic-components', thematicComponentRoutes_1.default);
app.use('/api/settings', settingRoutes_1.default);
app.use('/api/upload', uploadRoutes_1.default);
app.use('/api/terms', termRoutes_1.default);
app.use('/api/terms', termSectionClosureRoutes_1.default);
app.use('/api/residences', residenceRoutes_1.default);
app.use('/api/locations', locationRoutes_1.default);
app.use('/api/matriculations', matriculationRoutes_1.default);
app.use('/api/planteles', plantelRoutes_1.default);
app.use('/api/enrollment-questions', enrollmentQuestionRoutes_1.default);
app.use('/api/enrollment-answers', enrollmentAnswerRoutes_1.default);
app.use('/api/inscriptions/bulk', bulkEnrollmentRoutes_1.default);
app.use('/api/guardians', guardianRoutes_1.default);
app.use('/api/council', councilRoutes_1.default);
app.use('/api/performance-summary', performanceSummaryRoutes_1.default);
app.use('/api/certified-grades', certifiedGradesRoutes_1.default);
app.use('/api/templates', templateRoutes_1.default);
app.use('/api/grade-edit-permissions', gradeEditPermissionRoutes_1.default);
app.use('/api/period-closure', periodClosureRoutes_1.default);
app.use('/api/periods', periodOutcomeRoutes_1.default);
app.use('/api/dashboard', dashboardRoutes_1.default);
app.use('/api/enrollment-reports', enrollmentReportRoutes_1.default);
app.use('/api/dashboard-content', dashboardContentRoutes_1.default);
app.use('/api/health', healthRoutes_1.default);
app.use('/api/revision-periods', revisionPeriodRoutes_1.default);
app.use('/api/revision-grades', revisionGradeRoutes_1.default);
app.use('/api/external-grades', externalGradeRoutes_1.default);
app.use('/api/evaluation/catalogs', evaluationCatalogRoutes_1.default);
app.use('/api/section-guides', sectionGuideRoutes_1.default);
app.use('/api/historical-grades', historicalGradesRoutes_1.default);
app.use('/api/observations', observationRoutes_1.default);
app.use('/api/subject-presets', subjectPresetRoutes_1.default);
app.use('/api/structure-presets', structurePresetRoutes_1.default);
app.use('/api/pending-subjects', pendingSubjectRoutes_1.default);
app.use('/api/payments', paymentsRoutes_1.default);
app.use('/api/ledger', ledgerRoutes_1.default);
app.use('/api/constancias', constanciaRoutes_1.default);
app.use('/api/teacher-availability', teacherAvailabilityRoutes_1.default);
app.use('/api/schedules', scheduleRoutes_1.default);
app.use('/api/schedule-exceptions', scheduleExceptionRoutes_1.default);
app.use('/api/schedule-links', scheduleLinkRoutes_1.default);
app.use('/api/classroom-assignments', classroomAssignmentRoutes_1.default);
app.use('/api/room-bookings', roomBookingRoutes_1.default);
app.use('/api/diarios', diarioRoutes_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
app.use('/api/gate', gateRoutes_1.default);
// Serve uploaded files (logo, documents, dashboard images)
const findUploadsDir = () => {
    const candidates = [
        path_1.default.join(__dirname, '..', 'public', 'uploads'),
        path_1.default.join(process.cwd(), 'public', 'uploads'),
        path_1.default.join(__dirname, '..', '..', 'backend', 'public', 'uploads')
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(candidate)) {
            return candidate;
        }
    }
    return candidates[0];
};
app.use('/uploads', express_1.default.static(findUploadsDir()));
// Serve frontend static files (production build)
const findFrontendDist = () => {
    const candidates = [
        path_1.default.join(__dirname, '..', 'public'), // Production build folder layout (build/public)
        path_1.default.join(process.cwd(), 'public'),
        path_1.default.join(__dirname, '..', '..', 'frontend', 'dist'), // Dev workspace layout
        path_1.default.join(process.cwd(), 'frontend', 'dist')
    ];
    for (const candidate of candidates) {
        if (fs_1.default.existsSync(path_1.default.join(candidate, 'index.html'))) {
            return candidate;
        }
    }
    return candidates[0];
};
const frontendDist = findFrontendDist();
app.use(express_1.default.static(frontendDist));
// SPA fallback: serve index.html for any non-API route (React Router)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/uploads/')) {
        const indexPath = path_1.default.join(frontendDist, 'index.html');
        if (fs_1.default.existsSync(indexPath)) {
            return res.sendFile(indexPath);
        }
    }
    next();
});
// 404 handler for unmatched API routes
app.use('/api', errorHandlerMiddleware_1.notFoundHandler);
// Global error handler — must be last middleware (4-arity)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, req, res, next) => {
    (0, errorHandlerMiddleware_1.errorHandler)(err, req, res, next);
});
exports.default = app;
