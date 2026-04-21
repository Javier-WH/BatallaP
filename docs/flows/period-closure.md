# 🔒 Flujo: Cierre de período escolar

> Referencia de diseño detallada: [`../notes/arquitectura-cierre-periodos.md`](../../notes/arquitectura-cierre-periodos.md).

## Objetivo

Cerrar un `SchoolPeriod` activo, consolidar notas finales, generar `StudentPeriodOutcome` por estudiante, promover (o reprobar) y crear `PendingSubject` para materias reprobadas que se cursarán en el siguiente período.

## Actores

- **Master / Administrador**: inicia y ejecuta el cierre.
- **Control de Estudios**: consolida consejos de curso previamente.
- **Profesor**: debe tener todas las notas registradas antes del cierre.

## Modelos involucrados

- `SchoolPeriod` – período a cerrar.
- `PeriodClosure` – registro del proceso (quién, cuándo, estado).
- `CouncilChecklist` – requisito previo (consejos completos).
- `Inscription`, `InscriptionSubject`, `Qualification`, `CouncilPoint`, `SubjectFinalGrade`.
- `StudentPeriodOutcome` – resultado del estudiante (aprobado/reprobado/con pendientes).
- `PendingSubject` – materia a recuperar en el próximo período.
- `SchoolPeriodTransitionRule` – mapea `gradeFromId → gradeToId`.

## Pasos del flujo

### 1. Pre-validación

Endpoint: `GET /api/period-closure/:periodId/validate`

Verifica:
- Todas las `Inscription` activas tienen notas completas.
- Los consejos de curso están firmados (`CouncilChecklist`).
- No hay notas pendientes ni `CouncilPoint` sin resolver.

### 2. Checklist manual

Endpoint: `POST /api/period-closure/:periodId/checklist` – upsert de entradas de checklist (pasos manuales del cierre).

### 3. Preview

Endpoint: `GET /api/period-closure/:periodId/preview`

- Service: `periodClosurePreview.ts`.
- Calcula para cada estudiante:
  - Nota final por materia (`finalGradeCalculator`).
  - Resultado global (aprobado / reprobado / con pendientes).
  - Grado destino según `SchoolPeriodTransitionRule` + `studentPromotionEngine`.
- **No persiste nada**. Solo retorna la simulación.

### 4. Status

Endpoint: `GET /api/period-closure/:periodId/status` – estado actual (`not_started`, `in_progress`, `closed`).

### 5. Ejecución

Endpoint: `POST /api/period-closure/:periodId/execute`

- Service: `periodClosureExecutor.ts` (transaccional).
- Acciones:
  1. Crear `PeriodClosure` con `initiatedBy = userId`.
  2. Por cada `Inscription` activa:
     - Congelar `SubjectFinalGrade` (una por `InscriptionSubject`).
     - Crear `StudentPeriodOutcome`.
     - Para materias reprobadas: crear `PendingSubject` vinculado a la próxima `Inscription` (si existe) y `originPeriodId`.
  3. Desactivar el `SchoolPeriod` (opcional, según política).
  4. Dejar `PeriodClosure.status = 'closed'`.

### 6. Outcomes y pendientes (post-cierre)

- `GET /api/periods/:periodId/outcomes` – lista resultados.
- `GET /api/periods/:periodId/pending-subjects` – materias pendientes.
- `POST /api/periods/pending-subjects/:pendingSubjectId/resolve` – marcar materia como recuperada (aprobada en nuevo período).

## Reglas de promoción

`studentPromotionEngine.ts`:
- Aprobado en todas las materias → promoción al grado destino según `SchoolPeriodTransitionRule`.
- Reprobado en ≤ N materias (política) → promovido con pendientes (`PendingSubject`).
- Reprobado en > N materias → repitiente en el mismo grado.

El umbral N y reglas específicas se configuran en `Setting` o `AcademicSettings.tsx`.

## Edición posterior al cierre

Las notas finales (`SubjectFinalGrade`) de un período cerrado solo se pueden editar si el usuario tiene un `GradeEditPermission` activo. Ver [`grade-edit.md`](./grade-edit.md).

## Archivos clave

| Capa | Archivos |
|------|----------|
| Controllers | `periodClosureController.ts`, `periodOutcomeController.ts` |
| Services | `periodClosureService.ts`, `periodClosureExecutor.ts`, `periodClosurePreview.ts`, `studentPromotionEngine.ts`, `finalGradeCalculator.ts`, `periodOutcomeService.ts`, `pendingSubjectService.ts` |
| Modelos | `PeriodClosure`, `StudentPeriodOutcome`, `PendingSubject`, `SchoolPeriodTransitionRule`, `SubjectFinalGrade` |
| Frontend | `control-estudios/AcademicSettings.tsx`, `control-estudios/CourseCouncil.tsx` (desde ahí se suele iniciar). El panel de cierre aún puede estar distribuido entre módulos; verificar `periodClosure.ts` (service) y páginas que lo consumen. |
