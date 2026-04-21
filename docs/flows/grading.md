# ✏️ Flujo: Evaluación y calificaciones

## Actores

- **Profesor**: crea plan de evaluación, registra notas por estudiante.
- **Control de Estudios**: consolida notas finales, gestiona consejos de curso, edita notas de períodos cerrados (con permiso).
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

- Cálculo: `finalGradeCalculator.ts` combina `Qualification` por plan + `CouncilPoint` si aplica, respetando política definida en `AcademicSettings` o `Setting`.
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
| Services | `finalGradeCalculator.ts` |
| Modelos | `TeacherAssignment`, `EvaluationPlan`, `Qualification`, `SubjectFinalGrade`, `CouncilPoint`, `CouncilChecklist` |
| Frontend | `teacher/TeacherPanel.tsx`, `control-estudios/CourseCouncil.tsx`, `control-estudios/FinalGradesEdit.tsx`, `admin/TeacherProjection.tsx` |
