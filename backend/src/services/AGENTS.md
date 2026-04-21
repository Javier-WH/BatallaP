# AGENTS.md – `backend/src/services`

> Lógica de negocio reutilizable. Los services **no tocan `req`/`res`** – reciben y retornan datos.
> Se consumen desde los controllers.

## Inventario

| Service | Propósito | Controller(s) que lo usa |
|---------|-----------|--------------------------|
| `studentEnrollmentService` | Crea Persona + Contact + Residence + Inscription + subjects + representantes en una transacción. | `inscriptionController` |
| `studentGuardianService` | Helpers para asignar/demote/destroy en `StudentGuardian`. | `userController`, `studentEnrollmentService` |
| `guardianProfileService` | `findOrCreateGuardianProfile(document)` – fuente de verdad del ID correcto. | `guardianController`, `userController`, `studentEnrollmentService` |
| `bulkEnrollmentService` | Generación de plantilla Excel con named ranges, parsing, validación y ejecución masiva. | `bulkEnrollmentController` |
| `enrollmentAnswerService` | Guardado/lectura de respuestas del formulario de inscripción. | `enrollmentAnswerController` |
| `enrollmentReportService` | HTML → PDF con Puppeteer para reportes de matrícula. | `enrollmentReportController` |
| `plantelCatalog` | Búsqueda tipada y normalización de planteles. | `plantelController`, `studentEnrollmentService` |
| `finalGradeCalculator` | Calcula nota final de una materia (qualifications + council + política). | `evaluationController`, `periodClosureExecutor` |
| `periodClosureService` | Orquesta el cierre (status, validate, execute wrappers). | `periodClosureController` |
| `periodClosureExecutor` | Ejecuta el cierre efectivo: promueve, genera outcomes, congela notas, crea pendientes. | `periodClosureService` |
| `periodClosurePreview` | Simula resultados sin persistir. | `periodClosureController` |
| `periodOutcomeService` | Helpers sobre `StudentPeriodOutcome`. | `periodOutcomeController`, `periodClosureExecutor` |
| `pendingSubjectService` | CRUD/resolver sobre `PendingSubject`. | `periodOutcomeController`, `periodClosureExecutor` |
| `studentPromotionEngine` | Decide promoción / repitencia / pendientes según reglas. | `periodClosureExecutor` |

## Guías

- Si una lógica empieza a aparecer en más de un controller → extraer a un service.
- Los services deben aceptar `{ transaction?: Transaction }` como opción para componerse.
- Retornar tipos explícitos (interfaces `PromotionResult`, `ClosureSummary`, etc.).
- Logs con prefijo `[serviceName]` para debugging.

## Dependencias internas

```
bulkEnrollmentService ──► studentEnrollmentService
studentEnrollmentService ──► guardianProfileService, studentGuardianService, plantelCatalog
periodClosureService ──► periodClosureExecutor, periodClosurePreview
periodClosureExecutor ──► studentPromotionEngine, finalGradeCalculator, periodOutcomeService, pendingSubjectService
```

## Ver también

- [`docs/backend-modules.md`](../../../docs/backend-modules.md)
- [`docs/flows/enrollment.md`](../../../docs/flows/enrollment.md)
- [`docs/flows/period-closure.md`](../../../docs/flows/period-closure.md)
- [`docs/flows/grading.md`](../../../docs/flows/grading.md)
