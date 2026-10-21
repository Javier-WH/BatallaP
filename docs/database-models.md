# 🗄️ Modelos y base de datos

> Todas las asociaciones están centralizadas en [`backend/src/models/index.ts`](../backend/src/models/index.ts).
> Cada modelo vive en su propio archivo en `backend/src/models/`.

## Motor

- **MySQL** 5.7+ / 8.x
- **ORM**: Sequelize 6
- **Sync**: `sequelize.sync({ force: true })` (desarrollo), ver `npm run db:sync`.

## Modelos por dominio

### 👤 Personas, usuarios y roles

| Modelo | Descripción |
|--------|-------------|
| `User` | Credenciales de acceso (username + password hash). 1:1 con `Person`. Puede no existir si la persona no entra al sistema (ej. estudiante sin cuenta). |
| `Person` | Datos personales: nombre, apellidos, documento, fecha de nacimiento, género, etc. |
| `Contact` | Contacto de la persona (teléfono, email). 1:1 con `Person`. |
| `PersonResidence` | Residencia (estado, municipio, parroquia, dirección). 1:1 con `Person`. |
| `Role` | Rol del sistema (`Master`, `Administrador`, `Control de Estudios`, `Profesor`, `Representante`, `Alumno`). |
| `PersonRole` | Tabla pivot `Person` ↔ `Role` (M:N). |
| `GuardianProfile` | Perfil reutilizable de representante, identificado por documento. Permite que un mismo tutor represente a varios estudiantes sin duplicar datos. |
| `StudentGuardian` | Relación estudiante ↔ representante con `relationship` (`mother`/`father`/`representative`) y flag `isRepresentative`. |
| `StudentPreviousSchool` | Escuelas previas cursadas por el estudiante. |

### 🎓 Estructura educativa

| Modelo | Descripción |
|--------|-------------|
| `SchoolPeriod` | Período escolar (año académico). Campo `status` ENUM: `preinscripcion` (período en pre-inscripción), `activo` (período en curso, único), `historico` (período cerrado), `externo` (período de institución externa para notas de transferencia/equivalencia). Los virtuals `isActive` (= `status === 'activo'`) e `isExternal` (= `status === 'externo'`) se mantienen por compatibilidad pero **no** pueden usarse en cláusulas `where`. |
| `Grade` | Grado/año escolar (1ro, 2do, ..., 5to año). Ordenable. |
| `Section` | Sección (A, B, C, ...). `isMateriaPendiente` marca la sección auxiliar de Materia Pendiente — es el identificador canónico (el `name` es solo de exhibición y puede renombrarse sin romper nada). |
| `Subject` | Materia/asignatura. Puede pertenecer a un `SubjectGroup`. Para el generador de horarios: `allowConsecutiveBlocks`, `maxHoursPerDay`, `difficulty` (`heavy`/`medium`/`light`, default `medium`), `weeklyBlocks` (nullable — override global de bloques semanales; `null` = usa `PeriodGradeSubject.weeklyBlocks`). |
| `SubjectGroup` | Agrupación de materias electivas (sólo una es cursada por estudiante). |
| `Specialization` | Mención / especialidad (ej. "Ciencias", "Humanidades"). |
| `PeriodGrade` | Relación `SchoolPeriod` ↔ `Grade` (+ `Specialization` opcional). Unidad base de la estructura anual. |
| `PeriodGradeSection` | Secciones disponibles para un `PeriodGrade`. |
| `PeriodGradeSubject` | Materias del grado en el período; tiene orden, `includeInAverage` (cuenta para promedio) y `notRepairable` (excluida de Revisión y Materia Pendiente). Usa la `Subject` como plantilla. |
| `Term` | Lapsos dentro de un período (trimestre, semestre). Ordenado. |
| `SchoolPeriodTransitionRule` | Regla de promoción de un grado a otro (`gradeFromId` → `gradeToId`). |
| `Plantel` | Institución educativa (centro). Usado para calificaciones y reportes. |

### 📋 Inscripción / matrícula

| Modelo | Descripción |
|--------|-------------|
| `Matriculation` | Pre-inscripción/solicitud de un estudiante al período+grado+sección. Puede transformarse en `Inscription`. |
| `EnrollmentDocument` | Documentos adjuntos a la matrícula (partidas, informes, etc.). |
| `EnrollmentQuestion` | Pregunta configurable del formulario de inscripción (ordenable, activable). |
| `EnrollmentAnswer` | Respuesta de la persona a una pregunta. |
| `EnrollmentReport` | Reporte PDF generado para una matrícula (tiene `uuid` público). |
| `Inscription` | Inscripción formal del estudiante a un `SchoolPeriod` + `Grade` + `Section` (+ opcional `originPeriodId` si proviene de un cierre). `escolaridad` puede ser `regular`, `repitiente`, `materia_pendiente` o `transferencia` (esta última para inscripciones externas creadas por el flujo de notas externas). `rosterNumber` = número de lista en la sección (orden canónico), recalculado por `rosterNumberService` ante cada cambio de nómina; NULL si retirado o sin sección. |
| `InscriptionSubject` | Materia cursada por el estudiante dentro de una inscripción (M:N Inscription↔Subject). |

### ✏️ Evaluación y calificaciones

| Modelo | Descripción |
|--------|-------------|
| `EvaluationPlan` | Ítem del plan de evaluación de un `PeriodGradeSubject` en un `Term` (% + descripción + fecha). |
| `Qualification` | Nota de un `InscriptionSubject` para un ítem de `EvaluationPlan`. |
| `SubjectFinalGrade` | Nota final de la materia (calculada y/o ajustada), vinculada a `InscriptionSubject` y `Plantel`. `gradeType` puede ser `regular`, `revision`, `materia_pendiente`, `revision_materia_pendiente`, `transferencia` o `equivalencia`. Las externas (`transferencia`/`equivalencia`) guardan `plantelId` de la institución emisora y `calculatedAt` = fecha del documento original. |
| `CouncilPoint` | Punto discutido en el consejo de curso para un `InscriptionSubject` en un `Term`. |
| `CouncilChecklist` | Checklist por período/grado/sección/lapso para control de consejo de curso. |
| `TeacherAssignment` | Asignación de un `Person` (profesor) a un `PeriodGradeSubject` + `Section`. |

### 🔒 Cierre de período / outcomes

| Modelo | Descripción |
|--------|-------------|
| `PeriodClosure` | Registro del cierre de un período (quién lo inició, estado). |
| `StudentPeriodOutcome` | Resultado del estudiante en el período: aprobado, reprobado, con pendientes, grado de promoción destino. |
| `PendingSubject` | Materia pendiente heredada al próximo período (link a nueva `Inscription` y `originPeriod`). |
| `PendingSubjectEncounter` | Encuentro de evaluación de MP (1..N, N configurable via setting `pending_subject_max_encounters`). Fecha, nota, inasistencia. |
| `PendingSubjectContent` | Tema de estudio de MP (`themeTitle`). Varios por `PendingSubject`, ordenados por `order`. |
| `PendingSubjectContentItem` | Item de contenido dentro de un tema de MP. Lista ordenada, sin ponderación. |

### 🔐 Edición de notas

| Modelo | Descripción |
|--------|-------------|
| `GradeEditPermission` | Permiso para editar notas finales (`grantedBy`, `grantedTo`, `schoolPeriodId` nullable para global, vencimiento, revocación). |
| `GradeEditAudit` | Log de cada edición de nota final: valor previo, nuevo, usuario, permiso aplicado, timestamp. |

### 🖼️ Misceláneos

| Modelo | Descripción |
|--------|-------------|
| `Setting` | Config key/value del sistema. |
| `DashboardContent` | Contenido editable del dashboard principal (bloques, imágenes). |

### ✅ Asistencias

| Modelo | Descripción |
|--------|-------------|
| `AttendanceSession` | Sesión concreta de asistencia: `ScheduleEntry` + `sessionDate` (DATEONLY). UNIQUE(`scheduleEntryId`, `sessionDate`). Estado: `pending`/`completed`/`cancelled`. |
| `AttendanceRecord` | Asistencia de un estudiante en una sesión: `status` ENUM(`present`,`absent`,`late`,`excused`,`kicked`), `reason` (obligatorio para absent/kicked), bloqueo cruzado (`blocked`, `clearedBy`, `clearedAt`, `clearanceReasonCode/Note`), `markedAt`, `clientRecordId` UUID (idempotencia futura offline/RFID). UNIQUE(`sessionId`, `inscriptionId`). |
| `AttendanceAuditLog` | Auditoría append-only: `action` ENUM(`marked`,`blocked`,`cleared`,`status_changed`), `performedBy`, `previousValue`/`newValue` JSON. Nunca se edita ni borra. |
| `ClearanceReason` | Catálogo editable de motivos de desbloqueo (`code`, `label`, `requiresNote`, `active`). Se siembra automáticamente con 4 motivos por defecto. |
| `IdCard` | Tarjeta RFID por persona (`cardUid` UNIQUE, `active`, `revokedAt`). Base para el futuro gate check-in. |
| `GateDevice` | Lector de puerta (`identifier`, `location`, tipo `gate_reader`/`mobile`). |
| `GateCheckin` | Evento de puerta (`entry`/`exit`, `flaggedDuplicate` para el debounce de lector único). |

### 🗓️ Horarios

| Modelo | Descripción |
|--------|-------------|
| `Schedule` | Horario de una `PeriodGradeSection` en un `SchoolPeriod`. |
| `ScheduleEntry` | Bloque horario: día + período + materia (+ profesor) dentro de un `Schedule`. `isGroupSubject` marca materias de grupo que varias secciones ven simultáneamente. |
| `ScheduleException` | Excepción de generación por materia: `allowConsecutiveBlocks`, `maxHoursPerDay`, `difficulty` (`heavy`/`medium`/`light`), `forcedSlot` (`first_morning`/`last_afternoon`), `endOfRun` (`soft`/`hard` = debe ser la última materia ocupada de su turno). Sobrescribe los valores por defecto del generador (y de `Subject`). El override de bloques semanales vive en `Subject.weeklyBlocks`. |
| `ScheduleDayTurnException` | Fuerza una materia a un día+turno específicos: `periodGradeId` + `subjectId` + `day` + `turn` (`manana`/`tarde`) + `mode` (`soft`/`hard`, default `hard`) + `weight` opcional. `periodGradeSectionId` nullable limita a una sola clase (NULL = todo el grado). UNIQUE(`periodGradeId`, `periodGradeSectionId`, `subjectId`). El solver elige el/los bloque(s) dentro del turno; todo lo demás queda prohibido (hard) o penalizado (soft). |
| `ScheduleLink` | Vínculo manual entre materias de **diferentes grados** del mismo período para que el generador las coloque en el mismo bloque horario. Tiene `name` opcional y `schoolPeriodId`. |
| `ScheduleLinkItem` | Item de un vínculo: `linkId` + `subjectId` + `periodGradeId`. UNIQUE(`linkId`, `subjectId`, `periodGradeId`). Un par (materia, grado) solo puede pertenecer a un vínculo por período. |
| `TeacherAdminHour` | Hora administrativa pintada sobre el horario del profesor (no es materia ni `ScheduleEntry`). UNIQUE(`teacherId`, `schoolPeriodId`, `day`, `period_id`). Se limpian al regenerar horarios del período. Base para cuantificación de horas (futuro módulo de sueldos). |

### 💵 Pagos y Ledger

| Modelo | Descripción |
|--------|-------------|
| `ExchangeRateType` / `ExchangeRate` | Tipos de cambio y su historial por fecha. |
| `Fee` | Costo fijo (`key`: `mensualidad`/`matricula`/`gastos_administrativos`). **Versionado por `effectiveMonth`** (código de mes). UNIQUE(`schoolPeriodId`, `key`, `effectiveMonth`). La versión vigente en un mes es la activa con mayor `effectiveMonth` ≤ ese mes (`feeResolverService`). |
| `SellableItem` | Ítems vendibles (uniformes, distintivos…). `icon` = nombre de icono Lucide del badge del ledger; `iconImage` = imagen subida (`/uploads/items/`), tiene prioridad sobre `icon`. |
| `EnrollmentPlan` / `EnrollmentPlanItem` | Plan de inscripción (también con `effectiveMonth`) y sus ítems (costo o ítem vendible × cantidad). `autoApply=false` = plan opcional: nunca es el vigente por defecto; solo aplica a los estudiantes con `Inscription.enrollmentPlanId` asignado (NULL = plan vigente). |
| `Charge` | Deuda de una inscripción. `schoolPeriodId` es el **período de la deuda** (puede diferir del de la inscripción — deuda arrastrada de años anteriores); `month` se interpreta en el calendario de cobro de ese período. `month` NULL = deuda única (inscripción, ítems, extraordinarias). `source`: `schedule` (generada desde costos/plan) o `manual`. `scheduleKey` (p. ej. `mensualidad:Oct`, `plan:fee:matricula`) identifica la deuda generada; UNIQUE(`inscriptionId`, `scheduleKey`) garantiza idempotencia. `quantity` (default 1) = unidades compradas de un item (`amount` = precio unitario × cantidad). |
| `ChargeDelivery` | Entrega física de unidades de una deuda de item: `chargeId` → `Charge` (alias `deliveries`), `quantity`, `size` (talla entregada, obligatoria si el item tiene tallas), `note`, `deliveredByPersonId` → `Person` (alias `deliveredBy`). Permite entregas parciales (1 de 2 distintivos); la suma no puede exceder `Charge.quantity`. |
| `ItemInventoryMovement` | Movimiento de inventario de un item vendible: `sellableItemId` → `SellableItem` (alias `inventoryMovements`), `size` (null si el item no usa tallas), `quantity` con signo, `type` (`ingreso`/`ajuste`), `note`, `createdByPersonId` → `Person` (alias `createdBy`). **Stock = Σ movimientos − unidades entregadas de esa talla** (`itemInventoryService`); las entregas no crean movimientos. `SellableItem.sizes` (JSON) es la lista opcional de tallas del item. |
| `Payment` | Pago de una inscripción; `month` NULL = pago de deudas sin mes. `debtPeriodId` = período de la deuda que cubre (NULL = el de la inscripción). `equivalent`/`equivalentCurrency` = monto expresado en la moneda de la deuda según la tasa de `paymentDate`. `method` (string validado: efectivo, transferencia, pago_movil, zelle, zinli, binance, bybit, okx, tarjeta, otro), `currency` (USD/EUR/VES/USDT), `bank` (métodos bancarios), `account` (usuario/correo del pagador en plataformas), `registeredByPersonId` → `Person` (alias `registeredBy`: quién registró el pago), `clientRequestId` y `dedupeKey` (únicos, anti-duplicados). Un pago se **reparte** entre varias deudas vía `PaymentAllocation` (fuente de verdad del reparto); `chargeId`/`month`/`debtPeriodId`/`equivalent` quedan como resumen de compatibilidad. |
| `PaymentAllocation` | Parte de un pago acreditada a una deuda concreta (`paymentId` → `Payment` alias `payment`, `chargeId` → `Charge` alias `charge`; `Payment.allocations` / `Charge.allocations`). `amount` en la **moneda de la deuda**, `amountVES` en bolívares a la tasa de la fecha del pago. Un pago puede repartirse entre varias deudas de distinta moneda (p. ej. Bs. 69.000 → 40 EUR de inscripción + el resto en USD de una franela). El excedente queda en la última deuda. Pagos sin filas (anteriores al modelo) conservan la semántica de bucket por mes. |
| `PaymentAuditLog` | Registro de correcciones de pagos (solo se agrega): `paymentId` (sin FK, el pago puede haber sido eliminado), `action` (`deleted`/`moved`), `fromInscriptionId`, `toInscriptionId` (mover), `performedByPersonId` (`performer`), `reason`, `snapshot` (JSON del pago antes del cambio). |
| `DiscountReason` | Catálogo de motivos de descuento/beca (`name` único, `active`). |
| `Bank` | Catálogo de bancos: `code` (Sudeban, único), `name`, `shortName`, `rif`, `icon` (`/uploads/banks/…`), `active`. Se usa en el selector de banco al registrar pagos en VES. |
| `InscriptionDiscount` | Regla de descuento de una inscripción: `kind` (`percent`/`fixed`), `value`, `appliesTo` (`mensualidad`/`matricula`/`todo`), `fromMonth`/`toMonth`, `note`, `active`, `createdByPersonId`. Se evalúa **al leer** el ledger (el % sigue las tarifas); nunca se guarda como cargo negativo. |

`SchoolPeriod.usdAtPar` (bool, default false): los pagos en USD/USDT saldan deudas en EUR 1:1; `Payment.atPar` marca los pagos acreditados así. Campos relacionados: `SchoolPeriod.billingStartMonth`/`billingEndMonth` (1–12, default 9→8: meses que se cobran) e `Inscription.entryMonth` (mes de ingreso; NULL = desde el primer mes). `Inscription.papersHold` (bool): documentos retenidos por deuda tras el retiro; se libera al saldar (`refreshPapersHold`) o manualmente (`POST /api/ledger/inscriptions/:id/release-papers`).

## Asociaciones clave

### Usuarios
```
User ──1:1──► Person ──1:1──► Contact
                    │         
                    ├─1:1──► PersonResidence
                    ├─1:N──► StudentPreviousSchool
                    ├─1:N──► Inscription
                    ├─1:N──► Matriculation
                    ├─M:N──► Role (through PersonRole)
                    └─1:N──► StudentGuardian ──N:1──► GuardianProfile
```

### Estructura académica
```
SchoolPeriod ──M:N──► Grade (through PeriodGrade + Specialization?)
                                │
PeriodGrade ──M:N──► Section (through PeriodGradeSection)
PeriodGrade ──M:N──► Subject (through PeriodGradeSubject)
SubjectGroup ──1:N──► Subject
SchoolPeriod ──1:N──► Term
```

### Inscripción y evaluación
```
Inscription ──N:1──► SchoolPeriod, Grade, Section, Person (student)
Inscription ──1:N──► InscriptionSubject ──N:1──► Subject
Inscription ──1:1──► Matriculation
Inscription ──1:1──► StudentPeriodOutcome
Inscription ──1:N──► PendingSubject

PeriodGradeSubject ──1:N──► EvaluationPlan ──1:N──► Qualification
                   ──1:N──► TeacherAssignment ──N:1──► Person (teacher)

InscriptionSubject ──1:N──► Qualification
InscriptionSubject ──1:1──► SubjectFinalGrade ──N:1──► Plantel
InscriptionSubject ──1:N──► CouncilPoint
```

### Cierre y auditoría
```
SchoolPeriod ──1:N──► PeriodClosure ──N:1──► User (initiator)
SchoolPeriod ──1:N──► CouncilChecklist

SchoolPeriod ──1:N──► GradeEditPermission ──N:1──► User (granter/recipient/revoker)
SubjectFinalGrade ──1:N──► GradeEditAudit ──N:1──► GradeEditPermission, User (editor)
```

### Horarios
```
PeriodGradeSection ──1:1──► Schedule ──1:N──► ScheduleEntry ──N:1──► Subject, Person (teacher)
SchoolPeriod ──1:N──► ScheduleException ──N:1──► PeriodGradeSubject
PeriodGrade ──1:N──► ScheduleDayTurnException ──N:1──► Subject, PeriodGradeSection (scope opcional)
SchoolPeriod ──1:N──► ScheduleLink ──1:N──► ScheduleLinkItem ──N:1──► Subject, PeriodGrade
```

## Reglas de integridad importantes

- **`StudentGuardian`** tiene UNIQUE(`studentId`, `relationship`). Al cambiar representante con rol `mother`/`father` no se puede reutilizar la misma tupla; hay que demote (isRepresentative=false) o destroy según el caso. Ver memoria histórica del fix.
- **`GuardianProfile`** es la fuente de verdad del representante; `StudentGuardian` sólo apunta a él. Nunca guardar datos del tutor directamente en `StudentGuardian`.
- **`PendingSubject`** vincula la materia fallida en el período origen con la nueva `Inscription` del período destino.
- **`SubjectFinalGrade`** se puede modificar sólo si existe `GradeEditPermission` activo y se registra en `GradeEditAudit`.
- **Notas externas (transferencia/equivalencia)**: cuando un estudiante proviene de otra institución, se crea un `SchoolPeriod` con `status='externo'` que representa el año escolar de la institución origen, una `Inscription` con `escolaridad='transferencia'`, y por cada materia un `SubjectFinalGrade` con `gradeType='transferencia'|'equivalencia'`, `plantelId` apuntando al `Plantel` de la institución emisora y `calculatedAt` = fecha del documento original. El `FinalGradeCalculator` y el `periodClosureExecutor` ignoran estas inscripciones/notas. Ver [`docs/flows/grading.md`](./flows/grading.md) sección "Notas externas".
- **Asistencias**: `AttendanceSession` se deriva de `ScheduleEntry` + fecha (creación on-demand, admite backfill de fechas pasadas). El bloqueo cruzado marca `blocked=true` cuando el estudiante tiene `absent`/`kicked` sin desbloquear (`clearedAt` null) en una sesión anterior del mismo día. `AttendanceAuditLog` es append-only: cada marca, bloqueo, desbloqueo o cambio de estado inserta una fila nueva.

## Diagrama completo

Para un diagrama detallado generado manualmente ver [`notes/arquitectura-cierre-periodos.md`](../notes/arquitectura-cierre-periodos.md).

## Migraciones

- Fuente de verdad: los modelos + `sequelize.sync()`.
- Migraciones manuales en `backend/migrations/` y `backend/src/migrations/` son parches puntuales (ej. cambios a `EnrollmentDocument`, `Inscription.personId` constraint).
- Para aplicar manualmente: `npm run db:sync` reconstruye todo desde modelos.
