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
- `RevisionPeriod` – período de revisiones/reparaciones (debe estar completado o cerrado).

## Pasos del flujo

### 1. Pre-validación

Endpoint: `GET /api/period-closure/:periodId/validate`

Verifica:
- El período está activo (`SchoolPeriod.status='activo'`).
- Existe un período siguiente creado.
- Todos los lapsos están cerrados (ya sea `Term.isBlocked=true` o todas las secciones cerradas vía `TermSectionClosure`).
- Los consejos de curso están firmados (`CouncilChecklist.status='done'`).
- El período de revisiones no está abierto (`RevisionPeriod.status != 'open'`). Si no se abrió revisiones (`status='pending'`), la validación pasa sin error.
- No hay notas pendientes ni `CouncilPoint` sin resolver.

### 2. Checklist manual

Endpoint: `POST /api/period-closure/:periodId/checklist` – upsert de entradas de checklist (pasos manuales del cierre).

### 3. Preview

Endpoint: `GET /api/period-closure/:periodId/preview`

- Service: `periodClosurePreview.ts`.
- Calcula para cada estudiante:
  - Nota final por materia (`finalGradeCalculator`).
  - Resultado global (aprobado / reprobado / con pendientes / egresado).
  - Grado destino según `SchoolPeriodTransitionRule` + `studentPromotionEngine`.
  - Distinción de rezagado (vía `metadata.isRezagado`).
- **No persiste nada**. Solo retorna la simulación.

### 4. Status

Endpoint: `GET /api/period-closure/:periodId/status` – estado actual (`not_started`, `in_progress`, `closed`).

### 5. Ejecución

Endpoint: `POST /api/period-closure/:periodId/execute`

- Service: `periodClosureExecutor.ts` (transaccional).
- Acciones:
  1. Crear `PeriodClosure` con `initiatedBy = userId`.
  2. Excluir estudiantes retirados (`Inscription.withdrawnAt != null`).
  3. Por cada `Inscription` activa (no retirada, no transferencia):
     - Congelar `SubjectFinalGrade` (una por `InscriptionSubject`).
     - Crear/actualizar `StudentPeriodOutcome`.
     - Marcar `PendingSubject` aprobadas como `status='aprobada'`.
     - Si es egresado (`graduatedAt` no nulo): no crear inscripción, registrar en log.
     - Si es repitiente/rezagado: crear inscripción `repitiente` en grado destino + inscripción `materia_pendiente` con pendientes reprobadas.
     - Si es regular con pendientes: crear inscripción `regular` en grado siguiente + inscripción `materia_pendiente` con reprobadas.
     - Si es regular sin pendientes: crear inscripción `regular` en grado siguiente.
  4. Rotar estados: período cerrado → `historico`, siguiente → `activo`, crear nuevo `preinscripcion`.
  5. Cerrar `RevisionPeriod` (`status='closed'`).
  6. Dejar `PeriodClosure.status = 'closed'`.

### 6. Outcomes y pendientes (post-cierre)

- `GET /api/periods/:periodId/outcomes` – lista resultados.
- `GET /api/periods/:periodId/pending-subjects` – materias pendientes.
- `POST /api/periods/pending-subjects/:pendingSubjectId/resolve` – marcar materia como recuperada (aprobada en nuevo período).

## Reglas de promoción (9 reglas)

### R1. Prerrequisitos del cierre
Los consejos de curso deben estar completados (`CouncilChecklist.status='done'`) y las revisiones/reparaciones deben estar resueltas (`RevisionPeriod.status` en `completed` o `closed`) antes de poder ejecutar el cierre. Si no se abrieron revisiones, no es requisito.

### R2. Aprobados → siguiente grado
El estudiante que aprueba todas las materias se inscribe en el siguiente grado para el siguiente período escolar con `escolaridad='regular'`.

### R3. Reprobados > máximo → repitiente
El estudiante que reprueba un número de materias superior al máximo de materias reprobadas permitidas repite el año: se inscribe en el mismo grado para el siguiente período con `escolaridad='repitiente'`.

### R4. Reprobados ≤ máximo → siguiente grado + materias pendientes
El estudiante que reprueba un número de materias igual o inferior al máximo permitido se inscribe en el siguiente grado para el siguiente período con `escolaridad='regular'`, y además se inscriben las materias reprobadas con `escolaridad='materia_pendiente'` (inscripción separada en el grado anterior, sección "Materia Pendiente").

### R5. Reprueba materia pendiente → REZAGADO
Si un estudiante reprueba una o varias materias pendientes (del grado anterior), repite el grado actual por completo, sin importar si aprobó o reprobó las materias del grado actual. Técnicamente usa `escolaridad='repitiente'`, pero se distingue mediante `StudentPeriodOutcome.metadata.isRezagado = true`.

- Se crean DOS inscripciones:
  1. Inscripción `repitiente` en el grado actual con TODAS las materias regulares.
  2. Inscripción `materia_pendiente` en el grado anterior con SOLO las pendientes reprobadas.
- Las pendientes aprobadas se marcan como `status='aprobada'`.
- Las pendientes reprobadas se arrastran como nuevos `PendingSubject` al siguiente período.

### R6. Aprueba pendientes + aprueba grado actual → siguiente grado
Si el estudiante tiene materias pendientes y las aprueba todas, y también aprueba todas las materias del grado actual, se inscribe en el siguiente grado para el siguiente período con `escolaridad='regular'`. Las pendientes aprobadas se marcan como `status='aprobada'`.

### R7. Aprueba pendientes + reprueba ≤ max del grado actual → siguiente grado + nuevas MP
Si el estudiante aprueba todas sus materias pendientes pero reprueba algunas materias del grado actual (≤ máximo permitido), se inscribe en el siguiente grado para el siguiente período con `escolaridad='regular'`, y las materias reprobadas del grado actual se inscriben como materias pendientes siguiendo las reglas de R4. Las pendientes viejas aprobadas se marcan como `status='aprobada'`.

### R8. Último grado, aprueba todo → egresado
Si el estudiante está en el último grado configurado (ej: 5to año) y aprueba todas las materias inscritas (incluyendo pendientes), cambia su estado a egresado/graduado: se establece `StudentPeriodOutcome.graduatedAt = now`. No se crea inscripción en ningún período siguiente.

### R9. Último grado, reprueba cualquier materia → repitiente
Si el estudiante está en el último grado configurado y reprueba una o más materias (del grado actual o pendientes), debe repetir el año: se inscribe en el mismo grado para el siguiente período con `escolaridad='repitiente'` (o `rezagado` vía metadata si fue por materia pendiente), inscribiendo TODAS las materias del grado actual. Las pendientes reprobadas se arrastran como MP; las aprobadas se marcan como `aprobada`.

### R10. Exclusión de estudiantes retirados
Los estudiantes con `Inscription.withdrawnAt != null` (retirados) se excluyen completamente del proceso de cierre: no se les calcula resultado ni se inscriben en el siguiente período.

## Distinción "rezagado" vs "repitiente"

A nivel técnico, ambos usan `escolaridad='repitiente'` en la inscripción. La diferencia es el **motivo** de la repitencia:

| Tipo | Motivo | Diferenciador |
|------|--------|---------------|
| Repitiente | Reprobó > max materias del grado actual | `metadata.isRezagado` ausente o `false` |
| Rezagado | Reprobó ≥1 materia pendiente del grado anterior | `metadata.isRezagado = true` |

Esta distinción vive en `StudentPeriodOutcome.metadata` y permite reportes diferenciados sin requerir migración de base de datos.

## Configuración

El umbral `max_failed_subjects` y `min_approval_grade` se configuran en `Setting` o `AcademicSettings.tsx`.

Las reglas de transición entre grados se configuran en `SchoolPeriodTransitionRule` (una por grado origen).

## Edición posterior al cierre

Las notas finales (`SubjectFinalGrade`) de un período cerrado solo se pueden editar si el usuario tiene un `GradeEditPermission` activo. Ver [`grade-edit.md`](./grade-edit.md).

## Archivos clave

| Capa | Archivos |
|------|----------|
| Controllers | `periodClosureController.ts`, `periodOutcomeController.ts` |
| Services | `periodClosureService.ts`, `periodClosureExecutor.ts`, `periodClosurePreview.ts`, `studentPromotionEngine.ts`, `finalGradeCalculator.ts`, `periodOutcomeService.ts`, `pendingSubjectService.ts` |
| Modelos | `PeriodClosure`, `StudentPeriodOutcome`, `PendingSubject`, `SchoolPeriodTransitionRule`, `SubjectFinalGrade`, `RevisionPeriod`, `TermSectionClosure` |
| Frontend | `control-estudios/AcademicSettings.tsx`, `control-estudios/CourseCouncil.tsx` (desde ahí se suele iniciar). El panel de cierre aún puede estar distribuido entre módulos; verificar `periodClosure.ts` (service) y páginas que lo consumen. |
