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
| PUT/DELETE | `/:id` para cada uno | CRUD. `subjects` acepta `weeklyBlocks` (nullable — override global de bloques semanales para el generador de horarios; `null` = usar el default por grado). |
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
| GET | `/my-assignments` | Asignaciones del profesor logueado. `?schoolPeriodId=` filtra por período (default: activo). |
| GET | `/all-assignments` | Todas las asignaciones (Control de Estudios). `?schoolPeriodId=` filtra por período (default: activo). |
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
| GET | `/` | Liveness probe. Devuelve `status`, `database`, `version` (de `package.json` — se auto-incrementa el patch en cada `npm run build:prod`) y `timestamp`. |

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

**Sincronización de materias de grupo del mismo año** (`sync_group_subjects` setting, default `'true'`, gestionado desde el panel «Excepciones» de Control de Estudios → Horarios):
- Cuando está activo, un bloque+day solo es un slot de grupo válido si **todas** las secciones del año pueden colocar **todas** las materias del grupo ahí (todos los profesores libres). Si ningún bloque cumple, las materias del grupo quedan `unplaced` con razón «Sin bloque común para el grupo…» — nunca se separan silenciosamente.
- La misma regla dura aplica a los vínculos entre grados: un vínculo solo usa bloques donde todo el vínculo es colocable; de lo contrario queda `unplaced` con razón «Sin bloque común para el vínculo…».
- Cuando está inactivo (`'false'`), las materias de grupo se agendan de forma independiente entre secciones.

**Preferencias del solver (soft constraints)**: el solver CP-SAT (`backend/scripts/schedule_solver.py`) optimiza varias preferencias configurables por settings y por excepción de materia:

- **Compactación del día del salón**: cada día usado por una sección se penaliza si forma más de un tramo (`day_compactness_weight`, default `200`), si tiene menos de `min_consolidated_blocks_per_day` bloques (`thin_day_weight`, default `150`; el mínimo se edita en el panel «Excepciones», default `2`), o si algún tramo tiene menos bloques que ese mínimo (`short_visit_weight`, default `300` — una visita de 1 solo bloque no justifica el viaje). En la práctica: horarios continuos y sin venir solo a la mañana y volver a la tarde.
- **Bloques semanales por materia**: `Subject.weeklyBlocks` (nullable, se edita en el catálogo de materias — Control de Estudios → Configuración → «Académico») sobrescribe `PeriodGradeSubject.weeklyBlocks` (cuyo default es el setting `default_weekly_blocks_per_subject`). Resolución: `subject.weeklyBlocks ?? pgs.weeklyBlocks`.
- **Dificultad de materias** (`Subject.difficulty`, override en `ScheduleException.difficulty`): `heavy` evita bloques adyacentes con otra pesada en el mismo turno (`heavy_back_to_back_weight`, default `80`) y los últimos N bloques de cada turno (`heavy_late_block_weight`, default `40`; N = `heavy_avoid_last_n_morning`/`heavy_avoid_last_n_afternoon`, default `1`). Además hay un **gradiente posicional**: cada paso hacia el final del turno cuesta `heavy_position_weight` (default `20`) a una pesada y bonifica `light_position_bonus` (default `10`) a una ligera — crea presión de intercambio para que las pesadas queden temprano y las ligeras al final.
- **Misma materia dos veces en un día** (`same_day_subject_weight`, default `800`): una materia sin consecutividad obligatoria no debe verse dos veces el mismo día. Una corrida consecutiva cuenta como una sola sesión; cualquier otra duplicación se penaliza fuerte (por debajo de `1000`, para que duplicar siga siendo mejor que dejar horas sin colocar).
- **Bloques forzados** (`ScheduleException.forcedSlot`): `first_morning` o `last_afternoon` fuerzan (soft, peso `forced_slot_default_weight`, default `5000`) a que la materia se coloque en el primer bloque de la mañana o el último de la tarde cada día que se imparte, en todas las secciones que la ofrecen. Si la materia tiene `allowConsecutiveBlocks = 2` (consecutivo obligatorio), el objetivo es la **ventana de borde** de `weeklyBlocks` bloques — una corrida que termina la tarde (o empieza la mañana) cuenta como en-target, ya que una corrida no cabe en un solo bloque de borde.
- **Última del turno** (`ScheduleException.endOfRun`): `'soft'` u `'hard'`. Una materia marcada debe ser la **última ocupada de su turno** siempre que haya otra cosa colocada en el mismo turno (mañana y tarde son corridas independientes; sus propios bloques consecutivos no cuentan como «otra materia»). Si es lo único del turno, queda libre. `'soft'` penaliza `end_of_run_weight` (default `200`) por cada bloque posterior ocupado por otra materia; `'hard'` lo prohíbe directamente. Caso de uso: Educación Física de 4 h seguidas — los estudiantes ven lo demás primero y cierran el turno con ella.
- **Materia forzada a día+turno** (`ScheduleDayTurnException`, panel «Excepciones» → «Forzar materia a día y turno»): fija una materia a un día y turno concretos — ej. «Educación Física de 1er Año los viernes en la mañana». El scope es el grado completo (`periodGradeId`, todas sus secciones) o una sola clase (`periodGradeSectionId` = `PeriodGradeSection.id`, tiene precedencia). El solver sigue eligiendo qué bloque(s) dentro de ese turno (respeta `allowConsecutiveBlocks`, disponibilidad del profesor, etc.); cualquier otro día/turno queda prohibido (`mode='hard'`) o penalizado (`mode='soft'`, peso `forced_day_turn_weight` default `8000`, editable por entrada con `weight`). Con `hard`, si el objetivo es imposible (profesor ocupado, no cabe `weeklyBlocks`), la materia queda `unplaced` — nunca se coloca fuera.
- Los pesos se editan en Control de Estudios → Configuración Académica → «Ajustes avanzados del generador de horarios». Orden de prioridad del objetivo: colocar todo → bloques consecutivos → día+turno forzado → bloques forzados → no duplicar materia en un día → compactación (incluye última del turno soft) → dificultad → preferencias de profesor → sin huecos por turno → bloques tempranos.

**Distribución automática de aulas** (`ClassroomDistribution` → «Aplicar a la grid»):
- Los pares `(materia, grado)` de un vínculo que comparten profesor se agrupan en un cluster `(linkId, teacherId)` y se asignan a la **misma aula** — basta configurar el aula en uno de los grados del vínculo (la primera asignación `group` configurada entre los miembros define el aula del cluster).
- La celda de la grid guarda todos los grados vinculados: `group:subjectId:gradeId1,gradeId2,...`.
- Las materias sin vínculo mantienen su aula por grado configurada.

**Bloqueo de horarios**: el setting `schedules_locked_<schoolPeriodId>` (`'1'`/`'0'`, gestionado desde el checkbox «Bloqueado» en Control de Estudios → Horarios) pone en sólo lectura la edición manual de horarios, la distribución de aulas y la generación automática del período.

---

## ⚙️ Excepciones del generador – `/api/schedule-exceptions` (`scheduleExceptionRoutes.ts`)

Excepciones por materia (globales, aplican en todos los grados/secciones que la ofrecen):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/schedule-exceptions` | Lista excepciones por materia (`allowConsecutiveBlocks`, `maxHoursPerDay`, `difficulty`, `forcedSlot`, `endOfRun`) |
| POST | `/api/schedule-exceptions` | Upsert por `subjectId`. Body: `{ subjectId, allowConsecutiveBlocks?, maxHoursPerDay?, difficulty?, forcedSlot?, endOfRun? }` |
| PUT | `/api/schedule-exceptions/:id` | Reemplaza los campos de la excepción (los ausentes quedan `null`) |
| DELETE | `/api/schedule-exceptions/:id` | Elimina la excepción |

Excepciones de día+turno forzado (por grado + materia, una por par):

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/schedule-exceptions/day-turn?schoolPeriodId=` | Lista las excepciones día+turno (con `subject`, `periodGrade.grade` y `periodGradeSection.section`); `schoolPeriodId` opcional filtra por período |
| POST | `/api/schedule-exceptions/day-turn` | Upsert por `(periodGradeId, periodGradeSectionId, subjectId)`. Body: `{ periodGradeId, periodGradeSectionId?, subjectId, day, turn, mode?, weight? }`. `periodGradeSectionId` opcional limita a una sola clase (debe pertenecer al grado); `day` ∈ Lunes–Viernes, `turn` ∈ `manana`/`tarde`, `mode` ∈ `soft`/`hard` (default `hard`). Valida que la materia esté activa en el grado |
| DELETE | `/api/schedule-exceptions/day-turn/:id` | Elimina la excepción |

---

## 🕐 Horas administrativas – `/api/teacher-admin-hours` (`teacherAdminHourRoutes.ts`)

> Horas administrativas pintadas sobre el horario del profesor **después** de generar los horarios.
> No son materias ni `ScheduleEntry`: no aparecen en grids de sección, planes de evaluación,
> notas, ni asistencias. Solo las pinta **Control de Estudios** (también Master/Admin) desde
> Control de Estudios → Horarios → «Horarios por Profesor» → «Horas administrativas» (modo pintura).
> **Se eliminan al regenerar** los horarios del período (`generateSchedulesForPeriod`).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/summary?schoolPeriodId=` | Conteo de horas admin por profesor (`[{teacherId, count}]`) — base para cuantificación/sueldos. |
| GET | `/:teacherId?schoolPeriodId=` | Celdas pintadas del profesor: `{ "Lunes|m1": "admin", ... }`. |
| POST | `/:teacherId` | Bulk-replace de celdas. Body: `{ schoolPeriodId, cells: { "Lunes|m1": "admin" } }`. Solo staff (Master/Administrador/Control de Estudios). |

**Integración**:
- `GET /api/schedules/teacher/:personId` mergea las horas admin como pseudo-entries con `isAdminHour: true` → se renderizan en la vista del profesor (CE y propia, read-only) y en los Excel de profesor como «H.ADM» + fila «HORAS ADMINISTRATIVAS SEMANALES: N».
- El solver no las conoce ni las coloca; una celda con clase no puede pintarse.

---

## 📊 Carga horaria – `/api/teacher-workload` (`teacherWorkloadRoutes.ts`)

> Carga semanal **derivada** (no persistida) por profesor para un período escolar:
> horas de cátedra (asignaciones × bloques semanales) + horas administrativas pintadas.
> Reutilizable por Administración para cuantificación de horas/sueldos.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/?schoolPeriodId=` | `[{teacherId, firstName, lastName, teachingBlocks, teachingHours, adminHours, totalHours}]`. `schoolPeriodId` requerido. Staff (Master/Administrador/Control de Estudios) recibe todos los profesores; `Profesor` recibe solo su propia fila. |

**Cálculo** (`teacherWorkloadService`):
- `teachingBlocks`: Σ por **unidad docente** de `subject.weeklyBlocks ?? periodGradeSubject.weeklyBlocks`; excluye asignaciones en la sección `Materia Pendiente`. Incluye profesores sin asignaciones (carga 0).
  - Las unidades reflejan cómo el solver coloca los bloques: un `ScheduleLink` cuenta **una vez** aunque abarque varias secciones/años (mismo bloque físico); una materia de grupo (`subjectGroupId`) sin vínculo cuenta una vez por año (sus secciones son simultáneas); cualquier otra asignación cuenta por `(periodGradeSubjectId, sectionId)`. Ej.: una materia dada a 2 secciones × 2 años en el mismo bloque suma `weeklyBlocks` una sola vez.
- `teachingHours`: `teachingBlocks × min_academic_hours_per_block`.
- `adminHours`: conteo de `TeacherAdminHour` del período.
- `totalHours`: `teachingHours + adminHours`.

**Uso en frontend**: CE → Horarios → «Disponibilidad Profesores» (tag «Carga: N h/sem» junto al nombre + «Disponibles: N») y el propio profesor en `/profesor` → «Disponibilidad Semanal». Los bloques disponibles se calculan en vivo: `celdas totales − busy − preferred` (las celdas sin marcar cuentan como disponibles; los recreos no cuentan).

---

## 📜 Constancias – `/api/constancias` (`constanciaRoutes.ts`)

> Plantillas HTML con variables `{{categoria.campo}}` que se resuelven al generar el documento.
> Escritura restringida a Master/Administrador/Control de Estudios; la previsualización solo requiere sesión.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/constancias/variables` | Catálogo de variables disponibles para el editor (grupo, key, label) |
| GET | `/api/constancias/analyze/:id` | Clasifica las variables de una plantilla (`needsStudent`, `needsWorker`, `customVars`) |
| GET | `/api/constancias` | Lista plantillas (id, name, timestamps) |
| GET | `/api/constancias/:id` | Plantilla completa (incluye `content` HTML) |
| POST | `/api/constancias` | Crea plantilla `{ name, content }` |
| PUT | `/api/constancias/:id` | Actualiza `name`/`content` |
| DELETE | `/api/constancias/:id` | Elimina plantilla |
| POST | `/api/constancias/preview` | Renderiza la plantilla. Body: `{ templateId, personId?, schoolPeriodId?, customVars?, customDate? }` → `{ html, variables }` |

**Resolución de variables académicas** (`resolveVariables` en `constanciaController`):
- `grade.*` y `section.*` se resuelven desde la `Inscription` del estudiante en el período dado.
- Si el estudiante **no tiene inscripción** (aún no matriculado formalmente), se hace fallback a su `Matriculation` del período — ahí vive el grado/sección al que se está inscribiendo.
- Sin `schoolPeriodId`, el fallback toma la matrícula más reciente (`id DESC`).
- Las variables `subject.*` (notas finales) solo se resuelven con `Inscription` real.

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
