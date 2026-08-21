# ✏️ Flujo: Evaluación y calificaciones

## Actores

- **Profesor**: crea plan de evaluación, registra notas por estudiante.
- **Control de Estudios**: consolida notas finales, gestiona consejos de curso, edita notas de períodos cerrados (con permiso), registra notas externas (transferencia/equivalencia).
- **Administrador/Master**: otorga permisos y supervisa.

## Modelos clave

- `TeacherAssignment` – docente ↔ `PeriodGradeSubject` + `Section`.
- `EvaluationPlan` – ítems de evaluación (% + descripción + fecha) por `PeriodGradeSubject` en un `Term`.
- `Qualification` – nota por `InscriptionSubject` + `EvaluationPlan`.
- `SubjectFinalGrade` – nota final consolidada por `InscriptionSubject` y `Plantel`.
- `CouncilPoint` – punto de consejo de curso (nota propuesta) por `InscriptionSubject` + `Term`.
- `CouncilChecklist` – control de consejo por período/grado/sección/lapso.

## Paso 1: Asignar profesores

- Página: `admin/TeacherProjection.tsx`.
- Endpoints:
  - `GET /api/teachers/available/:periodId`
  - `POST /api/teachers/assign` → crea `TeacherAssignment`.
  - `DELETE /api/teachers/assign/:id`

## Paso 2: Plan de evaluación (Profesor)

- Página: `teacher/TeacherPanel.tsx` (tab Plan).
- Endpoints:
  - `GET /api/evaluation/my-assignments` → asignaciones del profesor logueado.
  - `GET /api/evaluation/plan/:periodGradeSubjectId`
  - `POST /api/evaluation/plan`
  - `PUT /api/evaluation/plan/:id`
  - `DELETE /api/evaluation/plan/:id`
- Validación: suma de `%` por lapso suele validarse en UI/controller.

## Paso 3: Registro de notas (Profesor)

- `GET /api/evaluation/students/:assignmentId`
- `GET /api/evaluation/qualifications/:inscriptionSubjectId`
- `POST /api/evaluation/qualifications` (upsert).

## Paso 4: Consejo de curso (Control de Estudios)

- Página: `control-estudios/CourseCouncil.tsx`.
- Endpoints:
  - `GET /api/council/data` – agregado por grado/sección/lapso.
  - `POST /api/council/save` – guarda un `CouncilPoint` (nota propuesta).
  - `POST /api/council/bulk-save` – guarda varios.
- Checklist: `CouncilChecklist` trackea qué consejos están completos por período/grado/sección/lapso.

## Paso 5: Nota final y expediente

- Cálculo centralizado: `gradeCalculationService.ts` es el single source of truth para
  calcular notas por lapso, nota final por materia y promedio general.
  Todos los endpoints y vistas deben usar este service (ver R15 y R16 en `rules/RULES.md`).
- `finalGradeCalculator.ts` usa `gradeCalculationService` durante el cierre de período.
  Mantiene la lógica de revisión de reparación y el upsert de `SubjectFinalGrade`.
- El calculator **ignora** las notas con `gradeType='transferencia'|'equivalencia'` (no las recalcula).

### Nota acumulada vs Nota final (R16)

El sistema distingue dos conceptos:

- **Nota acumulada**: nota calculada antes de que el consejo de curso del lapso
  esté completado. Se lee de `SubjectTermGrade`. Representa el progreso en tiempo real.
- **Nota final**: nota después de que el consejo de curso se marca como
  completado (`CouncilChecklist.status === 'done'`). Mismo cálculo, pero oficial.

Y dos tipos de promedio:
- **Promedio acumulado**: promedio de notas acumuladas (materias con `includeInAverage=true`).
- **Promedio final**: promedio de notas finales (materias con `includeInAverage=true`).
  Solo se calcula cuando los consejos relevantes están completados.

Reglas de visualización:
- **Documentos oficiales** (boletines, notas certificadas, promedios generales,
  Excel de rendimiento): solo muestran **notas finales**. Si el consejo no está
  done → mostrar "—".
- **Vistas operativas** (expediente, edición de notas, panel del profesor,
  consejo de curso): muestran **nota acumulada** para ver progreso en tiempo real.

## Notas externas (transferencia / equivalencia)

Cuando un estudiante proviene de otra institución educativa y se necesita registrar
sus notas previas (para imprimir notas certificadas con la institución de origen
de cada nota), se usa el flujo de notas externas.

### Actores
- **Control de Estudios / Administrador / Master**: registran y gestionan las notas externas.

### Modelos involucrados
- `Plantel` – institución emisora (reutilizado del catálogo existente; se crea si no existe).
- `SchoolPeriod` con `status='externo'` – representa el año escolar de la institución origen.
- `Inscription` con `escolaridad='transferencia'` – inscripción del estudiante en el período externo.
- `InscriptionSubject` – materia dentro de la inscripción externa.
- `SubjectFinalGrade` con `gradeType='transferencia'|'equivalencia'` – nota externa, con `plantelId` del emisor y `calculatedAt` = fecha del documento original.

### Página
- `control-estudios/ExternalGrades.tsx` (ruta `/control-estudios/notas-externas`).
- Tres pestañas:
  1. **Registro individual**: buscar estudiante → buscar/crear plantel → definir período y grado externo → agregar notas una a una.
  2. **Todas las notas externas**: listado con filtros.
  3. **Carga masiva Excel**: descarga plantilla, sube archivo, validación por fila.

### Endpoints (`/api/external-grades`)
- `POST /planteles` – resolve or create plantel externo.
- `POST /inscriptions` – crea inscripción externa (período externo + grado).
- `POST /grades` – upsert nota externa.
- `PUT /grades/:id` – edita nota externa.
- `DELETE /grades/:id` – elimina nota externa.
- `GET /persons/:personId` – inscripciones + notas externas del estudiante.
- `GET /grades` – listado con filtros (`personId`, `plantelId`).
- `GET /bulk/template` – descarga plantilla Excel.
- `POST /bulk/process` – procesa Excel cargado (multipart).
- `POST /bulk` – carga masiva vía JSON.

### Service
- `externalGradeService.ts`:
  - `resolveOrCreatePlantel` – busca por código DEA o crea.
  - `resolveOrCreateExternalPeriod` – busca o crea `SchoolPeriod` con `status='externo'`.
  - `createExternalInscription` – crea `Inscription` con `escolaridad='transferencia'`.
  - `upsertExternalGrade` – crea/actualiza `SubjectFinalGrade` externa.
  - `registerExternalGradesBatch` – orquestación transaccional para bulk.

### Integración con otros flujos
- **Cierre de período**: `periodClosureExecutor` excluye inscripciones con `escolaridad='transferencia'`.
- **Cálculo de nota final**: `finalGradeCalculator` salta notas con `gradeType='transferencia'|'equivalencia'`.
- **Notas certificadas**: `certifiedGradesController` incluye `plantel` emisor en cada nota y marca los períodos externos con `status='externo'`.
- **Gestión académica**: `academicController.getPeriods` excluye períodos externos (`status != 'externo'`).
- Endpoints:
  - `GET /api/evaluation/student-record/:personId` – expediente completo.
  - `GET /api/evaluation/final-grades-by-period?...` – listado filtrable.
  - `PUT /api/evaluation/final-grade/:id` – editar nota final. Si el período está cerrado, valida permiso en `GradeEditPermission` y escribe `GradeEditAudit`.

## Paso 6: Edición de notas de períodos anteriores

Ver [`grade-edit.md`](./grade-edit.md).

## Archivos clave

| Capa | Archivos |
|------|----------|
| Controllers | `teacherController.ts`, `evaluationController.ts`, `councilController.ts` |
| Services | `finalGradeCalculator.ts`, `gradeCalculationService.ts`, `termGradeSyncService.ts` |
| Modelos | `TeacherAssignment`, `EvaluationPlan`, `Qualification`, `SubjectFinalGrade`, `CouncilPoint`, `CouncilChecklist` |
| Frontend | `teacher/TeacherPanel.tsx`, `control-estudios/CourseCouncil.tsx`, `control-estudios/FinalGradesEdit.tsx`, `admin/TeacherProjection.tsx` |
