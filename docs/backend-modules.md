# 🧩 Módulos del backend

> Esta guía mapea cada archivo del backend a su responsabilidad. Para el detalle de endpoints ver [`backend-api.md`](./backend-api.md); para modelos ver [`database-models.md`](./database-models.md).

## Estructura

```
backend/src/
├── app.ts              # Configura Express, CORS, sesión, registra rutas
├── server.ts           # Punto de entrada: conecta DB + levanta server
├── seed.ts             # Seed básico (usuarios demo con todos los roles)
├── config/             # database.ts (conexión Sequelize)
├── constants/          # Constantes compartidas
├── assets/             # venezuela.json (catálogo geográfico)
├── controllers/        # Lógica HTTP (ver tabla abajo)
├── services/           # Lógica de negocio reutilizable
├── middlewares/        # Multer (uploads) y otros
├── models/             # Modelos Sequelize (ver database-models.md)
├── routes/             # Definición de rutas Express
├── migrations/         # Migraciones manuales puntuales
├── seeders/            # Seeds avanzados (estructura académica, matrículas masivas)
└── types/              # Tipos globales
```

## 📑 Controllers (`backend/src/controllers/`)

| Archivo | Responsabilidad |
|---------|-----------------|
| `authController.ts` | Login/logout/me/register. Maneja sesiones `express-session`. |
| `userController.ts` | Búsqueda, detalle y update completo de usuarios (persona + roles + contacto + residencia + representantes). Valida permisos del editor según su rol. |
| `academicController.ts` | CRUD de períodos, grados, secciones, materias, subject groups, especializaciones y estructura período-grado-sección-materia. |
| `inscriptionController.ts` | Inscripciones: CRUD, registro+inscripción, quick-register, matrículas (`getMatriculations`, `enrollMatriculatedStudent`, etc.), manejo de materias por inscripción. Archivo grande (~47 KB) por concentrar múltiples flujos. |
| `bulkEnrollmentController.ts` | Inscripción masiva vía Excel: descarga de plantilla, preview, procesamiento y reintento de filas. Delega al `bulkEnrollmentService`. |
| `teacherController.ts` | Lista de profesores, materias disponibles por período, asignar/remover profesor a materia+sección. |
| `evaluationController.ts` | Planes de evaluación, calificaciones, expediente académico, notas finales. Filtra por profesor logueado para sus asignaciones. |
| `guardianController.ts` | Buscar/crear representantes (GuardianProfile + Persona). Lista estudiantes a cargo del representante logueado. |
| `gradeEditPermissionController.ts` | CRUD de permisos para editar notas finales de períodos cerrados. Verifica permiso activo y escribe auditoría. |
| `periodClosureController.ts` | Status, validación, preview y ejecución de cierre de período. Consume `periodClosureService` y `periodClosureExecutor`. |
| `periodOutcomeController.ts` | Outcomes de estudiantes y materias pendientes (ver/resolver). |
| `councilController.ts` | Consejos de curso: obtener datos agregados, guardar puntos individuales o masivos (`bulkSaveCouncilPoints`). |
| `termController.ts` | CRUD de lapsos (trimestres/semestres) dentro de un período. |
| `plantelController.ts` | CRUD y búsqueda de planteles (centros educativos). |
| `enrollmentQuestionController.ts` | CRUD de preguntas del formulario de inscripción. Soporta reorder y activación/desactivación. |
| `enrollmentAnswerController.ts` | Guardar y leer las respuestas de un estudiante. |
| `enrollmentReportController.ts` | Generar reporte PDF de matrícula (usa Puppeteer). Buscar por persona o UUID público. |
| `residenceController.ts` | Upsert de dirección de residencia por persona. |
| `locationController.ts` | Servir el catálogo geográfico de Venezuela (estados/municipios/parroquias). |
| `studentPreviousSchoolController.ts` | CRUD de escuelas previas del estudiante, con bulk-replace. |
| `dashboardController.ts` | Métricas de los dashboards Master y Control/Admin. |
| `dashboardContentController.ts` | Contenido editable del dashboard (bloques, imágenes). |
| `settingController.ts` / `settingsController.ts` | Settings clave/valor. |
| `uploadController.ts` | Subida de logo institucional y documentos. |
| `healthController.ts` | Liveness endpoint. |

## 🧠 Services (`backend/src/services/`)

| Archivo | Propósito |
|---------|-----------|
| `bulkEnrollmentService.ts` | Generación de plantilla Excel (ExcelJS) con named ranges y catálogos; parsing, validación y ejecución por lotes. ~30 KB, el más complejo. |
| `studentEnrollmentService.ts` | Flujo core de inscripción: crea persona, contacto, residencia, inscripción, asigna materias, maneja representantes. |
| `studentGuardianService.ts` | Helpers para la relación estudiante ↔ representante en `StudentGuardian`. |
| `guardianProfileService.ts` | `findOrCreateGuardianProfile`, reutilización de perfiles de representantes por documento. |
| `studentPromotionEngine.ts` | Motor de promoción al cierre: aprobado/reprobado/con materias pendientes según reglas (`SchoolPeriodTransitionRule`). |
| `periodClosureService.ts` | Orquesta la validación y ejecución del cierre de período. |
| `periodClosureExecutor.ts` | Implementación efectiva del cierre: promueve estudiantes, genera outcomes, congela notas finales. Transaccional. |
| `periodClosurePreview.ts` | Calcula resultados tentativos sin persistir. |
| `periodOutcomeService.ts` | Helpers para `StudentPeriodOutcome`. |
| `pendingSubjectService.ts` | Gestión de materias pendientes (`PendingSubject`) entre períodos. |
| `finalGradeCalculator.ts` | Calcula la nota final de una materia según definitivas por lapso + política activa. |
| `enrollmentAnswerService.ts` | Lógica de guardado/lectura de respuestas del formulario de inscripción. |
| `enrollmentReportService.ts` | Render HTML + Puppeteer para PDFs de matrícula. |
| `plantelCatalog.ts` | Normalización/búsqueda tipada de planteles. |

## 🛡️ Middlewares (`backend/src/middlewares/`)

| Archivo | Uso |
|---------|-----|
| `uploadMiddleware.ts` | Multer genérico para `/api/upload/logo`. |
| `documentUploadMiddleware.ts` | Multer para documentos (`/api/upload/documents`). |
| `excelUploadMiddleware.ts` | Multer para archivos Excel (`/api/inscriptions/bulk/preview`). |
| `dashboardImageUploadMiddleware.ts` | Multer para imágenes del dashboard. |

⚠️ No existe todavía un middleware global `requireAuth` / `requireRole`. La autenticación se asume por la cookie de sesión y cada controller valida el rol cuando importa.

## 🌱 Seeders (`backend/src/seeders/`)

Seeds avanzados ejecutables con `ts-node`:

| Script | Comando |
|--------|---------|
| `academicStructureSeeder.ts` | `npm run seed:academic-structure` |
| `subjectGroupsSeeder.ts` | `npm run seed:subject-groups` |
| `bulkMatriculationsSeeder.ts` | `npm run seed:bulk-inscriptions` |
| `unregisteredStudentsSeeder.ts` | `npm run seed:unregistered` |

`npm run seed:full-reset` hace reset completo + ejecuta todos en orden.

## 🧪 Tests (`backend/src/__tests__/`)

Tests unitarios/integración con Jest + supertest. Detalles en [`../backend/README_TESTS.md`](../backend/README_TESTS.md).

## Ver también

- [`backend-api.md`](./backend-api.md)
- [`database-models.md`](./database-models.md)
- [`flows/`](./flows/)
- [`backend/src/controllers/AGENTS.md`](../backend/src/controllers/AGENTS.md)
- [`backend/src/models/AGENTS.md`](../backend/src/models/AGENTS.md)
- [`backend/src/services/AGENTS.md`](../backend/src/services/AGENTS.md)
- [`backend/src/routes/AGENTS.md`](../backend/src/routes/AGENTS.md)
