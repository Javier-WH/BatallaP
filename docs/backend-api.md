# 🌐 Referencia de API REST

> Base URL por defecto: `http://localhost:3000/api`
> Todas las rutas (excepto `/auth/login`, `/auth/register`, `/health`, y GETs públicos puntuales) requieren una sesión válida (cookie `connect.sid`).

Los namespaces están registrados en [`backend/src/app.ts`](../backend/src/app.ts). Cada uno corresponde a un archivo en `backend/src/routes/`.

## 🔐 Autenticación – `/api/auth` (`authRoutes.ts`)

| Método | Ruta | Controlador | Descripción |
|--------|------|-------------|-------------|
| POST | `/login` | `authController.login` | Iniciar sesión con `username` + `password`. Crea sesión. |
| POST | `/logout` | `authController.logout` | Destruye la sesión actual. |
| GET | `/me` | `authController.me` | Devuelve usuario autenticado + roles. |
| POST | `/register` | `authController.register` | Registro público (debe protegerse/retirarse en producción). |

## 👥 Usuarios – `/api/users` (`userRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Buscar usuarios (query params: `q`, `role`, ...). |
| GET | `/:id` | Obtener detalles completos de un usuario/persona. |
| PUT | `/:id` | Actualizar datos personales, contacto, residencia, roles, representante. |
| DELETE | `/:id/account` | Eliminar la cuenta de usuario (no la persona). |

### Escuela previa del estudiante – `/api/users/:personId/student-previous-schools` (`studentPreviousSchoolRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar escuelas previas del estudiante. |
| GET | `/:id` | Detalle de una escuela previa. |
| POST | `/` | Crear. |
| PUT | `/:id` | Actualizar. |
| DELETE | `/:id` | Eliminar. |
| PUT | `/` | Reemplazar el conjunto completo (bulk replace). |

## 🎓 Estructura académica – `/api/academic` (`academicRoutes.ts`)

### Períodos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/periods` | Listar períodos. |
| GET | `/active` o `/periods/active` | Período activo. |
| GET | `/preinscription` o `/periods/preinscription` | Período de preinscripción. |
| POST | `/periods` | Crear período. |
| POST | `/periods/ensure-preinscription` | Garantiza que exista el período de preinscripción siguiente al activo (usa `ensureNextPreinscriptionPeriod`). |
| PUT | `/periods/:id` | Actualizar período. |
| PUT | `/periods/:id/activate` | Activar/desactivar. |
| DELETE | `/periods/:id` | Eliminar. |
| GET | `/periods/:periodId/outcomes` | Resultados finales de estudiantes del período. |

### Catálogos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/grades`, `/sections`, `/subjects`, `/subject-groups`, `/specializations` | CRUD. |
| PUT/DELETE | `/:id` para cada uno | CRUD. |
| POST | `/grades/reorder` | Reordenar grados. |

### Estructura por período
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/structure/:periodId` | Árbol completo: grados → secciones + materias. |
| POST | `/structure/period-grade` | Añadir grado a un período. |
| DELETE | `/structure/period-grade/:id` | Retirar grado del período. |
| POST | `/structure/section` | Añadir sección a grado-período. |
| POST | `/structure/section/remove` | Retirar sección. |
| POST | `/structure/subject` | Añadir materia. |
| POST | `/structure/subject/remove` | Retirar materia. |
| POST | `/structure/subject/reorder` | Reordenar materias del grado. |
| POST | `/structure/subject/toggle-average` | Alternar `includeInAverage` (cuenta para promedio). |
| POST | `/structure/subject/toggle-repairable` | Alternar `notRepairable` (excluye de Revisión y Materia Pendiente). |
| GET | `/structure/subject/:periodGradeId/:subjectId` | Detalle de la relación período-grado-materia. |

## 📋 Inscripciones – `/api/inscriptions` (`inscriptionRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar inscripciones (filtros por query). Paginación opt-in vía `page`/`pageSize`. |
| GET | `/stats` | Conteo agregado (total + desglose por grado) sin descargar filas. |
| GET | `/:id` | Detalle de inscripción + materias. |
| POST | `/` | Crear inscripción para persona existente. |
| POST | `/register` | Registrar Persona + inscribir (sin crear User). |
| POST | `/quick-register` | Inscripción mínima (admin) con datos acotados. |
| PUT/PATCH | `/:id` | Actualizar inscripción. |
| DELETE | `/:id` | Eliminar inscripción. |
| POST | `/:id/subjects` | Agregar materia manualmente. |
| DELETE | `/:id/subjects/:subjectId` | Remover materia. |

### Inscripción masiva – `/api/inscriptions/bulk` (`bulkEnrollmentRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/template` | Descargar plantilla Excel con catálogos y selectores. |
| POST | `/preview` | Subir Excel (multipart `file`) → validación + preview. |
| POST | `/process` | Procesa las filas validadas. |
| POST | `/retry-single` | Reintentar una sola fila fallida. |

Ver [`flows/enrollment.md`](./flows/enrollment.md).

## 📝 Matriculación – `/api/matriculations` (`matriculationRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar matrículas. Paginación opt-in vía `page`/`pageSize`. |
| GET | `/stats` | Conteo agregado sin descargar filas. |
| GET | `/:id` | Detalle. |
| PATCH | `/:id` | Actualizar matrícula. |
| POST | `/:id/enroll` | Convertir matrícula en inscripción formal. |

## 📄 Reportes de inscripción – `/api/enrollment-reports` (`enrollmentReportRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/generate/:matriculationId` | Genera reporte PDF para la matrícula. |
| GET | `/person/:personId` | Reportes del estudiante. |
| GET | `/:uuid` | Recuperar por UUID público. |

## 📂 Documentos / Uploads – `/api/upload` (`uploadRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/logo` | Subir logo institucional (multipart `logo`). |
| GET | `/logo` | Servir logo actual. |
| GET | `/planning-logo` | Servir el logo utilizado temporalmente en el Excel de planificación. |
| POST | `/documents` | Subir documento genérico (multipart `file`). |

## 👨‍🏫 Profesores – `/api/teachers` (`teacherRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar usuarios con rol `Profesor`. |
| GET | `/available/:periodId` | Materias disponibles del período para asignar. |
| POST | `/assign` | Asignar profesor a `periodGradeSubject` + sección. |
| DELETE | `/assign/:id` | Remover asignación. |

## 📝 Evaluaciones – `/api/evaluation` (`evaluationRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/my-assignments` | Asignaciones del profesor logueado. |
| GET | `/plan/:periodGradeSubjectId` | Plan de evaluación (ítems). |
| POST | `/plan` | Crear ítem. |
| PUT | `/plan/:id` | Editar ítem. |
| DELETE | `/plan/:id` | Eliminar ítem. |
| GET | `/students/:assignmentId` | Estudiantes de la asignación. |
| GET | `/qualifications/:inscriptionSubjectId` | Notas de un estudiante en una materia. |
| POST | `/qualifications` | Guardar/actualizar nota. |
| GET | `/student-record/:personId` | Expediente académico completo. |
| PUT | `/final-grade/:id` | Actualizar nota final (requiere permiso si es período cerrado). |
| GET | `/final-grades-by-period` | Notas finales del período (filtros por query). |
| GET | `/export-planning/:assignmentId` | Excel de planificación del lapso, con contenidos, aprendizajes y proceso evaluativo. |
| GET | `/export-grades-oficial/:assignmentId` | Acta oficial de notas en Excel. |

Ver [`flows/grading.md`](./flows/grading.md).

## 🏫 Planteles – `/api/planteles` (`plantelRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar planteles con filtros. |
| GET | `/search` | Autocomplete de planteles. |
| GET | `/by-id/:id` | Plantel por ID numérico. |
| GET | `/:code` | Plantel por código o nombre. |
| POST | `/` | Crear. |
| PUT | `/:id` | Actualizar. |
| DELETE | `/:id` | Eliminar. |

## 👪 Representantes (Guardians) – `/api/guardians` (`guardianRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/search` | Buscar representante por documento; crea `GuardianProfile` si no existe. |
| POST | `/` | Crear representante nuevo (persona + GuardianProfile). |
| GET | `/my-students` | Estudiantes a cargo del representante logueado. |

## 🏠 Residencia – `/api/residences` (`residenceRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/:personId` | Residencia de la persona. |
| PUT | `/:personId` | Upsert de residencia. |

## 🌎 Ubicaciones – `/api/locations` (`locationRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/venezuela` | Catálogo Estados / Municipios / Parroquias (desde `backend/src/assets/venezuela.json`). |

## ❓ Preguntas de inscripción – `/api/enrollment-questions` (`enrollmentQuestionRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar. |
| POST | `/` | Crear. |
| PUT | `/:id` | Actualizar. |
| PATCH | `/reorder` | Reordenar. |
| PATCH | `/:id/status` | Cambiar status activo/inactivo. |
| PATCH | `/:id/deactivate` | Desactivar. |

## 💬 Respuestas de inscripción – `/api/enrollment-answers` (`enrollmentAnswerRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/:personId` | Respuestas del estudiante. |
| POST | `/` o `/:personId` | Guardar respuestas. |

## 🗓️ Lapsos (Terms) – `/api/terms` (`termRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Listar (filtro `schoolPeriodId`). |
| GET | `/:id` | Detalle. |
| POST | `/` | Crear. |
| PUT | `/:id` | Actualizar. |
| DELETE | `/:id` | Eliminar. |
| POST | `/reorder` | Reordenar. |

## 🏛️ Consejo de curso – `/api/council` (`councilRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/data` | Datos agregados para el panel de consejo. |
| POST | `/save` | Guardar un punto (nota final propuesta). |
| POST | `/bulk-save` | Guardar múltiples puntos. |

## 🔒 Cierre de período – `/api/period-closure` (`periodClosureRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/:periodId/status` | Estado del cierre. |
| POST | `/:periodId/checklist` | Upsert de entrada de checklist. |
| GET | `/:periodId/validate` | Validar precondiciones. |
| GET | `/:periodId/preview` | Preview de promociones/resultados. |
| POST | `/:periodId/execute` | Ejecutar el cierre (transacción). |

Ver [`flows/period-closure.md`](./flows/period-closure.md).

## 📊 Resultados del período – `/api/periods` (`periodOutcomeRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/:periodId/outcomes` | Outcomes por estudiante. |
| GET | `/:periodId/pending-subjects` | Materias pendientes. |
| POST | `/pending-subjects/:pendingSubjectId/resolve` | Resolver materia pendiente. |

## 📋 Materia Pendiente – `/api/pending-subjects` (`pendingSubjectRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/structure` | Estructura de MP por grado (período activo). |
| GET | `/students/:gradeId` | Estudiantes disponibles para registrar en MP. |
| POST | `/register` | Registrar estudiantes en MP. |
| DELETE | `/remove/:inscriptionSubjectId` | Remover estudiante de MP. |
| GET | `/nomina/:gradeId/encounter` | Nómina por encuentro (query `?encounter=N`). |
| GET | `/nomina/:gradeId` | Nómina general de MP. |
| GET | `/nomina-final/:gradeId` | Nómina final con última nota conseguida. |
| GET | `/teacher-assignments` | Asignaciones de MP del profesor logueado. |
| GET | `/assignment/:periodGradeSubjectId` | Detalle de asignación (plan + estudiantes). |
| GET | `/assignment/:periodGradeSubjectId/encounters` | Estudiantes con encuentros para una asignación. |
| POST | `/final-grade` | Guardar nota final directa (sistema legacy). |
| POST | `/evaluation-plan` | Crear item de plan de evaluación MP (legacy). |
| PUT | `/evaluation-plan/:id` | Editar item de plan (legacy). |
| DELETE | `/evaluation-plan/:id` | Eliminar item de plan (legacy). |
| POST | `/qualification` | Guardar calificación de plan (legacy). |
| GET | `/:pendingSubjectId/encounters` | Listar encuentros (auto-crea N según setting). |
| PUT | `/:pendingSubjectId/encounters` | Actualizar fechas de encuentros. |
| POST | `/:pendingSubjectId/encounters/:encounterNumber/score` | Registrar nota de encuentro. Si aprueba (≥10), marca MP como aprobada. |
| GET | `/:pendingSubjectId/content` | Obtener contenido de estudio (Tema General + Contenidos). |
| PUT | `/:pendingSubjectId/content` | Guardar contenido de estudio. |

**Setting relacionado**: `pending_subject_max_encounters` (default: 4) — configurable en `/control-estudios/configuracion`.

## ✏️ Permisos de edición de notas – `/api/grade-edit-permissions` (`gradeEditPermissionRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/` | Crear permiso (Master/Admin). |
| GET | `/` | Listar permisos. |
| DELETE | `/:id` | Revocar permiso. |
| GET | `/check/:schoolPeriodId` | Verificar permiso activo del solicitante. |
| GET | `/audit` | Log de auditoría. |

Ver [`flows/grade-edit.md`](./flows/grade-edit.md).

## 📈 Dashboards – `/api/dashboard` (`dashboardRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/control` | Métricas del panel de control (Administrador/Control de Estudios). |
| GET | `/master` | Métricas del dashboard Master. |
| GET | `/admin-stats` | Métricas agregadas del dashboard Admin (COUNT/GROUP BY, sin descargar listas). |

## 🖼️ Contenido editable del dashboard – `/api/dashboard-content` (`dashboardContentRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Obtener contenido (público). |
| PUT | `/` | Actualizar (Master/Admin). |
| POST | `/images` | Subir imagen (multipart `image`). |
| DELETE | `/images/:filename` | Eliminar imagen. |

## ⚙️ Settings – `/api/settings` (`settingRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Todos los settings. |
| POST | `/` | Actualizar en batch. |
| GET | `/:key` | Setting por clave. |

## 🩺 Health – `/api/health` (`healthRoutes.ts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/` | Liveness probe. |

---

## 🔄 Notas externas – `/api/external-grades` (`externalGradeRoutes.ts`)

> Registro de notas de estudiantes provenientes de otras instituciones educativas
> (transferencia / equivalencia). Roles permitidos: `Master`, `Administrador`,
> `Control de Estudios`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/persons/:personId` | Inscripciones externas + notas del estudiante. |
| GET | `/grades` | Lista todas las notas externas (filtros: `personId`, `plantelId`). |
| GET | `/subjects` | Catálogo de materias (para selectores). |
| GET | `/bulk/template` | Descarga plantilla Excel para carga masiva. |
| POST | `/planteles` | Resuelve o crea un plantel externo (por código DEA o nombre). |
| POST | `/inscriptions` | Crea inscripción externa (período externo + grado + plantel). |
| POST | `/grades` | Upsert de una nota externa individual. |
| PUT | `/grades/:id` | Actualiza una nota externa existente. |
| DELETE | `/grades/:id` | Elimina una nota externa. |
| POST | `/bulk` | Carga masiva vía JSON (arreglo de entradas). |
| POST | `/bulk/process` | Carga masiva vía Excel (multipart, campo `file`). |

**Notas**:
- Cada nota externa se guarda en `SubjectFinalGrade` con `gradeType='transferencia'|'equivalencia'`, `plantelId` del plantel emisor y `calculatedAt` = fecha del documento original.
- El `FinalGradeCalculator` y el `periodClosureExecutor` ignoran estas notas/inscripciones.
- Los períodos externos (`SchoolPeriod.status='externo'`) no aparecen en los selectores de gestión académica.

---

**Notas**:
- Cada nota externa se guarda en `SubjectFinalGrade` con `gradeType='transferencia'|'equivalencia'`, `plantelId` del plantel emisor y `calculatedAt` = fecha del documento original.
- El `FinalGradeCalculator` y el `periodClosureExecutor` ignoran estas notas/inscripciones.
- Los períodos externos (`SchoolPeriod.status='externo'`) no aparecen en los selectores de gestión académica.

---

## ✅ Asistencias – `/api/attendance` (`attendanceRoutes.ts`)

> Módulo de asistencia en aula. Las sesiones se derivan del horario publicado
> (`Schedule` → `ScheduleEntry`) + fecha calendario, con creación on-demand y
> backfill de fechas pasadas (asistencia en papel). Roles: `Profesor`,
> `Control de Estudios`, `Administrador`, `Master`, `Director`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/my-sessions?date=YYYY-MM-DD` | Sesiones del profesor para la fecha (desde su horario). Fin de semana → vacío. |
| GET | `/sessions/:id` | Nómina de la sección + registros de asistencia. |
| PUT | `/sessions/:id/records` | Guardado masivo. Body: `{ records: [{ inscriptionId, status, reason? }] }`. El profesor solo puede guardar en sus sesiones; staff en cualquiera. |
| POST | `/records/:id/clear` | Desbloquea un registro. Body: `{ reasonCode, reasonNote? }` (nota obligatoria si el motivo lo requiere). |
| GET | `/records/:id/audits` | Auditoría del registro (solo staff). |
| GET | `/clearance-reasons` | Motivos de desbloqueo activos (siembra 4 defaults la primera vez). |
| GET | `/sessions?schoolPeriodId=&dateFrom=&dateTo=` | Vista staff: sesiones con conteos (filtros opcionales `gradeId`, `sectionId`). |
| GET | `/students/:personId/summary?schoolPeriodId=` | Historial completo de asistencia del estudiante + totales. |

**Reglas de negocio**:
- `absent` y `kicked` requieren `reason` (validado en service y UI).
- **Bloqueo cruzado**: un estudiante con `absent`/`kicked` sin desbloquear en una sesión anterior del mismo día aparece `blocked` en las siguientes sesiones. Cualquier desbloqueo exige motivo del catálogo `ClearanceReason` y queda auditado.
- `AttendanceAuditLog` es append-only (acciones: `marked`, `blocked`, `cleared`, `status_changed`).

## 🚪 Gate check-in (RFID) – `/api/gate` (`gateRoutes.ts`)

> Base para el futuro sistema de RFID en la puerta (hardware no desplegado).
> El endpoint ya implementa la lógica de debounce/toggle del lector único y
> acepta `eventType` fijo cuando se instalen dos lectores por puerta.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/checkins` | Body: `{ cardUid, deviceId?, eventType?, timestamp? }`. Resuelve la persona por `IdCard`, infiere entry/exit (o confía en el lector), aplica debounce 5s y marca `flaggedDuplicate` en ventana de 60s. |

**Notas**:
- Las tarjetas 125kHz emiten un UID estático: usar para asistencia/notificación, no como control de acceso.
- El worker de notificaciones a representantes es una fase futura; por ahora el check-in solo persiste el evento.

---

## 🔗 Vínculos de horarios entre grados – `/api/schedule-links` (`scheduleLinkRoutes.ts`)

Permite vincular manualmente materias de diferentes años/grados para que el generador
automático de horarios las coloque en el mismo bloque horario.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/schedule-links?schoolPeriodId=` | Lista los vínculos del período, con sus items (subject + periodGrade) |
| POST | `/api/schedule-links` | Crea un vínculo. Body: `{ name?, schoolPeriodId, items: [{ subjectId, periodGradeId }] }` |
| DELETE | `/api/schedule-links/:id` | Elimina un vínculo (cascadea sus items) |

**Validaciones**:
- Se requieren al menos 2 items por vínculo.
- Un par `(subjectId, periodGradeId)` solo puede pertenecer a un vínculo por período.

**Comportamiento del generador**:
- Las materias vinculadas se fuerzan al mismo bloque+day en el solver CP-SAT.
- Los profesores pueden ser independientes (no se exige que sean el mismo).
- Las materias no vinculadas siguen el comportamiento normal.
- **Conflicto de profesor**: las materias de grupo (`subjectGroupId`) solo comparten bloque entre secciones del **mismo grado**; entre grados distintos solo coexisten si el par `(subjectId, periodGradeId)` está en un vínculo. Un profesor nunca queda en dos unidades no relacionadas a la vez.

**Distribución automática de aulas** (`ClassroomDistribution` → «Aplicar a la grid»):
- Los pares `(materia, grado)` de un vínculo que comparten profesor se agrupan en un cluster `(linkId, teacherId)` y se asignan a la **misma aula** — basta configurar el aula en uno de los grados del vínculo (la primera asignación `group` configurada entre los miembros define el aula del cluster).
- La celda de la grid guarda todos los grados vinculados: `group:subjectId:gradeId1,gradeId2,...`.
- Las materias sin vínculo mantienen su aula por grado configurada.

**Bloqueo de horarios**: el setting `schedules_locked_<schoolPeriodId>` (`'1'`/`'0'`, gestionado desde el checkbox «Bloqueado» en Control de Estudios → Horarios) pone en sólo lectura la edición manual de horarios, la distribución de aulas y la generación automática del período.

---

## Patrones generales

- **Autenticación**: implícita por sesión. Revisar `req.session` en los controllers que requieren usuario logueado.
- **Errores**: código HTTP + `{ message: '...' }` en español.
- **Fechas**: `dayjs` en backend y frontend.
- **Archivos**: multipart/form-data a través de middlewares en `backend/src/middlewares/`.
- **Transacciones**: los controllers con múltiples writes usan `sequelize.transaction()`.

## Ver también

- [`backend-modules.md`](./backend-modules.md) – detalle funcional de cada controller/service.
- [`database-models.md`](./database-models.md) – modelos y asociaciones.
- [`flows/`](./flows/) – flujos de negocio end-to-end.
