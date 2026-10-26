# AGENTS.md – `backend/src/services`

> Lógica de negocio reutilizable. Los services **no tocan `req`/`res`** – reciben y retornan datos.
> Se consumen desde los controllers.

## Inventario

| Service | Propósito | Controller(s) que lo usa |
|---------|-----------|--------------------------|
| `studentEnrollmentService` | Crea Persona + Contact + Residence + Inscription + subjects + representantes en una transacción. | `inscriptionController` |
| `studentGuardianService` | `assignGuardians` (reemplaza los vínculos y **conserva el benefactor** si no se indica lo contrario) y `buildEditGuardianAssignments` (tarjetas del formulario de edición: una sección sin nombres ni documento se ignora; si trae algo, exige nombres, apellidos, tipo y número de documento y responde 400 `GuardianInputError`; teléfono/dirección/residencia pueden quedar vacíos; un solo benefactor). | `userController`, `studentEnrollmentService` |
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
| `externalGradeService` | Registro de notas externas (transferencia/equivalencia) con plantel emisor y período externo. | `externalGradeController` |
| `thematicScopeService` | `resolveContentTeacherId(pgsId, sectionId)`: el contenido temático (`ThematicComponent.teacherId`) es por profesor — compartido entre las secciones del mismo año/materia que da ese profesor, invisible para otros profesores de la materia. | `thematicComponentController`, `revisionGradeController`, `evaluationController` |
| `thematicCopyService` | `copyThematicTree()`: clonación aditiva del árbol componentes→contenidos→aprendizajes entre PeriodGradeSubject (materias de grupo entre años), con dedup por título y mapas de ids. `mapThematicIdsByTitle()`: remapeo read-only para copiar planes manteniendo vínculos. | `thematicComponentController`, `evaluationController` |
| `teacherWorkloadService` | Carga semanal derivada por profesor: `Σ(subject.weeklyBlocks ?? pgs.weeklyBlocks)` por unidad docente (links/grupos cuentan una vez) × horas/bloque + horas admin (excluye sección MP). | `teacherWorkloadController` |
| `billingCalendarService` | Calendario de cobro del período (`billingStartMonth`→`billingEndMonth`, default Sep→Aug): meses, mes de ingreso por fecha, mensualidades que corresponden desde un mes de ingreso (el de ingreso lo cubre la inscripción). | `feeResolverService`, `chargeScheduleService`, controllers de pagos/ledger |
| `feeResolverService` | `pickEffective`, `resolveFee`, `resolveEnrollmentPlan`: versión de costo/plan vigente en un mes (mayor `effectiveMonth` ≤ mes). | `chargeScheduleService`, `paymentsController`, `ledgerController` |
| `chargeScheduleService` | Genera las deudas de una inscripción (plan vigente + mensualidades) de forma idempotente; omite secciones de Materia Pendiente y retirados (nunca filtra por `escolaridad`); `safeGenerateCharges` no bloquea inscripciones; `deactivateUnpaidScheduledCharges` al retirar (acepta `untilMonth` para conservar hasta un mes). Los ítems del plan se denominan en la **moneda destino del plan** (`targetExchangeRateTypeId` + `conversionMode`: `same_amount` = mismo monto otra moneda; `exchange_rate` = conversión por tasa Bs. del día de generación, sin tasa → moneda original + warning). Las mensualidades no son ítems del plan y conservan la moneda del fee. | `inscriptionController`, `periodClosureExecutor`, `chargeSyncService` |
| `paymentRulesService` | Reglas por método de pago (qué exige cada uno: banco + últimos 4 dígitos, cuenta del pagador, notas), monedas permitidas (USD/EUR/VES/USDT) y huella `buildDedupeKey` para detectar pagos repetidos. | `ledgerController` |
| `paymentAllocationService` | `distributePayment(payment, target)`: reparte un pago entre las deudas pendientes en orden cronológico, cada parte en la **moneda de la deuda** (a la tasa de la fecha del pago; USD/USDT→EUR 1:1 si el período tiene `usdAtPar`); el excedente queda en la última deuda. Targets: `auto` (todo en orden: período viejo → paquete de inscripción [matrícula > gastos administrativos > mensualidad incluida] → items/'otro' → mensualidades no incluidas en inscripción), `tuition` (solo académicas), `item` (items vendibles, excepción del orden — el elegido primero, excedente al siguiente item), `charge`, `month`, `oneTime`. `planSharedPayment` simula (sin escribir) el reparto de un pago entre varios estudiantes con una lista global de deudas ordenadas. Persiste `PaymentAllocation`. `checkTargetOrder(inscriptionId, target)` valida el **orden estricto**: un target dirigido solo puede apuntar a la próxima deuda pendiente (devuelve `blocking` con las anteriores); `createPayment` rechaza con 400 `OUT_OF_ORDER_PAYMENT`. | `ledgerController` |
| `debtBalanceService` | Deuda multi-período y equivalencias: orden cronológico de períodos de deuda (viejo→nuevo, luego calendario de cobro), conversión pago↔moneda de la deuda vía `ExchangeRate` de la fecha del pago (VES→USD/EUR y viceversa), balances por bucket (período+mes+moneda), asignación automática de pagos solo a cargos `active`, `hasOutstandingDebt`, `refreshPapersHold` (libera `papersHold` al llegar a cero; nunca lo reactiva). `inscriptionDebtSummary` compara por moneda de la deuda ($165 contra $165 = saldado aunque la tasa Bs. haya cambiado); `outstandingVES` valúa el saldo restante a la tasa de hoy. | `ledgerController`, `inscriptionController` |
| `debtCarryoverService` | `carryOverDebts(from, to)`: al cerrar el período, el saldo pendiente de cada cargo de la inscripción vieja se re-crea en la nueva como deuda **manual del período original** (`schoolPeriodId` intacto → cadena entre cierres; sin `scheduleKey` para no chocar con las mensualidades nuevas). El cargo viejo se retira (sin pagos) o se reduce a lo ya pagado. Mantiene `papersHold`. `safeCarryOverDebts` corre en un savepoint y nunca bloquea el cierre. Usa `pendingByCharge` de `paymentAllocationService`. | `periodClosureExecutor` |
| `chargeSyncService` | Plan/aplicación de generación y sincronización por período (botón "Generar / actualizar deudas"): crea faltantes y ajusta deudas `schedule` con saldo; no toca manuales ni pagadas completas, ni re-denomina la moneda de un cargo que ya recibió pagos (sus asignaciones quedarían registradas en la moneda vieja). | `paymentsController` |
| `currencyDiscountService` | Descuentos por pagar en una divisa (`CurrencyDiscount`, por período, vigencia opcional): `findActiveCurrencyDiscount`, `settleCharge` (costo en unidades de pago de saldar una deuda: porcentaje = 1/(1-p) de poder de compra; monto fijo = rebaja si el pago la salda completa, una vez por deuda), `chargesWithFixedBonus`. No toca las deudas: el bono se guarda en `PaymentAllocation.bonus`/`currencyDiscountId`. Se acumula con `discountService`. | `paymentAllocationService` |
| `discountService` | `discountForCharge` / `applyDiscountsToCharges`: descuentos (% o fijo, alcance, rango de meses) evaluados al leer el ledger; tope = monto de la deuda. | `ledgerController` |
| `rosterNumberService` | Mantiene `Inscription.rosterNumber` = posición en orden canónico (`compareStudents`) dentro de la sección. Se renumera ante cualquier cambio de nómina (inscripción, retiro, cambio de sección/grado, edición de datos del estudiante, cierre de período). Retirados → NULL. | `inscriptionController`, `pendingSubjectController`, `userController`, `periodClosureExecutor` |
| `termSectionClosureService` | Cierre de lapso por sección+grado (`TermSectionClosure`) + lectura de consejo completado (`CouncilChecklist.status='done'`). `getTermFinishTimestamp` = corte oficial del lapso (min de `closedAt`/`completedAt`), usado para decidir si un retirado sigue visible en ese lapso. | `evaluationController`, `councilController`, `termSectionClosureController` |
| `termGradeSyncService` | Fuente de verdad de notas por lapso (`SubjectTermGrade`): `syncForInscriptionSubject` recalcula desde qualifications + puntos de consejo (lapsos sin aporte → MIN). `resyncAfterEvaluationRemoval` re-sincroniza tras borrar/mover evaluaciones y **elimina** los snapshots (y `SubjectFinalGrade` regular) cuando la materia queda sin contribuciones, evitando notas fantasma en vistas históricas/certificadas. | `evaluationController`, `councilController`, `finalGradeCalculator` |

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
