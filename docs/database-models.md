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
| `Section` | Sección (A, B, C, ...). |
| `Subject` | Materia/asignatura. Puede pertenecer a un `SubjectGroup`. |
| `SubjectGroup` | Agrupación de materias electivas (sólo una es cursada por estudiante). |
| `Specialization` | Mención / especialidad (ej. "Ciencias", "Humanidades"). |
| `PeriodGrade` | Relación `SchoolPeriod` ↔ `Grade` (+ `Specialization` opcional). Unidad base de la estructura anual. |
| `PeriodGradeSection` | Secciones disponibles para un `PeriodGrade`. |
| `PeriodGradeSubject` | Materias del grado en el período; tiene orden y usa la `Subject` como plantilla. |
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
| `Inscription` | Inscripción formal del estudiante a un `SchoolPeriod` + `Grade` + `Section` (+ opcional `originPeriodId` si proviene de un cierre). `escolaridad` puede ser `regular`, `repitiente`, `materia_pendiente` o `transferencia` (esta última para inscripciones externas creadas por el flujo de notas externas). |
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
| `PendingSubjectContent` | Contenido de estudio global de MP (Tema General). Uno por `PendingSubject`. |
| `PendingSubjectContentItem` | Item de contenido dentro del Tema General de MP. Lista ordenada, sin ponderación. |

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

## Reglas de integridad importantes

- **`StudentGuardian`** tiene UNIQUE(`studentId`, `relationship`). Al cambiar representante con rol `mother`/`father` no se puede reutilizar la misma tupla; hay que demote (isRepresentative=false) o destroy según el caso. Ver memoria histórica del fix.
- **`GuardianProfile`** es la fuente de verdad del representante; `StudentGuardian` sólo apunta a él. Nunca guardar datos del tutor directamente en `StudentGuardian`.
- **`PendingSubject`** vincula la materia fallida en el período origen con la nueva `Inscription` del período destino.
- **`SubjectFinalGrade`** se puede modificar sólo si existe `GradeEditPermission` activo y se registra en `GradeEditAudit`.
- **Notas externas (transferencia/equivalencia)**: cuando un estudiante proviene de otra institución, se crea un `SchoolPeriod` con `status='externo'` que representa el año escolar de la institución origen, una `Inscription` con `escolaridad='transferencia'`, y por cada materia un `SubjectFinalGrade` con `gradeType='transferencia'|'equivalencia'`, `plantelId` apuntando al `Plantel` de la institución emisora y `calculatedAt` = fecha del documento original. El `FinalGradeCalculator` y el `periodClosureExecutor` ignoran estas inscripciones/notas. Ver [`docs/flows/grading.md`](./flows/grading.md) sección "Notas externas".

## Diagrama completo

Para un diagrama detallado generado manualmente ver [`notes/arquitectura-cierre-periodos.md`](../notes/arquitectura-cierre-periodos.md).

## Migraciones

- Fuente de verdad: los modelos + `sequelize.sync()`.
- Migraciones manuales en `backend/migrations/` y `backend/src/migrations/` son parches puntuales (ej. cambios a `EnrollmentDocument`, `Inscription.personId` constraint).
- Para aplicar manualmente: `npm run db:sync` reconstruye todo desde modelos.
