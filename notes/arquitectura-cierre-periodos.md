---
description: Arquitectura para cierre de periodos escolares y reinscripción automática
---

# Arquitectura: Cierre de Periodos Escolares y Reinscripción Automática

## 1. Objetivos Funcionales
1. **Cerrar un periodo escolar** solo cuando:
   - Todos los lapsos (`Term`) estén bloqueados.
   - Cada sección haya registrado sus **Consejos de Curso** (puntos adicionales) para cada materia.
2. **Calcular notas definitivas** por materia combinando:
   - Porcentaje acumulado de `EvaluationPlan` + `Qualification`.
   - Puntos de consejo (`CouncilPoint`) del último lapso.
3. **Clasificar a cada estudiante** en uno de tres estados:
   - `aprobado` (todas las materias ≥ nota mínima).
   - `materias_pendientes` (≤ 3 materias reprobadas).
   - `reprobado` (más de 3 materias reprobadas o promedio general < mínimo).
4. **Automatizar reinscripciones** para el siguiente periodo activo:
   - `reprobado`: repetir mismo grado y secciones asignadas.
   - `materias_pendientes`: avanzar al siguiente grado, pero inscribir materias pendientes como “arrastres”.
   - `aprobado` en último grado disponible: marcar como egresado (sin reinscribir).

## 2. Cambios y Nuevas Entidades
| Entidad | Tipo | Propósito |
|---------|------|-----------|
| `PeriodClosure` | Tabla nueva | Representa el proceso de cierre de un `SchoolPeriod` (estados: `draft`, `validating`, `closed`, `failed`). Guarda usuario responsable, timestamp y bitácora. |
| `SubjectFinalGrade` | Tabla nueva (una fila por `InscriptionSubject`) | Persiste nota definitiva, puntos de consejo aplicados y estado (`aprobada`, `reprobada`). Permite auditoría aun después de mover calificaciones. |
| `StudentPeriodOutcome` | Tabla nueva | Resumen por estudiante/periodo: promedio general, materias reprobadas, puntos extra aplicados, estado final. |
| `PendingSubject` | Tabla nueva | Materias a repetir en periodo siguiente. Relaciona inscripción del nuevo periodo con la materia/no. |
| `SchoolPeriodTransitionRule` | Catálogo | Define nota mínima aprobatoria, máximo de materias pendientes permitido y grado destino por grado de origen (dinámico). |
| `CouncilChecklist` | Tabla nueva | Marca por sección/lapso si se cargaron y cerraron los puntos de consejo (evita cerrar sin este paso). |

> Nota: En vez de nuevas tablas independientes, `SubjectFinalGrade` puede implementarse como columnas adicionales en `InscriptionSubject`, pero la tabla dedicada brinda trazabilidad y evita reescrituras.

## 3. Flujo de Cierre de Periodo

### 3.1. Preparación (Estado `draft → validating`)
1. Admin solicita cierre vía endpoint `POST /api/periods/:id/close`.
2. Servicio `PeriodClosureService` inicia registro en `PeriodClosure` (estado `validating`).
3. Validaciones automáticas:
   - Todos los `Term` del periodo tienen `isBlocked = true`.
   - `CouncilChecklist` marcado para cada (grade, section, term).
   - No existen `EvaluationPlan` sin porcentaje asignado o estudiantes sin `InscriptionSubject` para materias del pensum.
4. Si falla alguna validación, el cierre queda en estado `failed` con detalle.

### 3.2. Cálculo de calificaciones definitivas
1. Por cada `Inscription` del periodo:
   - Iterar `InscriptionSubject` asociadas.
   - Calcular `notaBase = Σ(qualification.score * evaluationPlan.percentage)`.
   - Obtener puntos de consejo del último lapso y sumarlos (respetando máximo configurable).
   - Guardar resultado en `SubjectFinalGrade`.
2. Determinar estado por materia (`aprobada`/`reprobada`) comparando con nota mínima (por grado o global).
3. Para el estudiante:
   - Contar materias reprobadas y promedio general.
   - Clasificar en `StudentPeriodOutcome.status` según reglas.

> Este cálculo debe ejecutarse dentro de una **transacción** por lote (ej. por sección) para evitar estados parciales.

### 3.3. Reinscripción automática
1. Identificar el **siguiente periodo activo** (o crear borrador si no existe).
2. Aplicar reglas:
   - `reprobado`: crear nueva `Inscription` en mismo grado/sección disponible. Copiar materias planificadas y marcar estado “Repetidor”.
   - `materias_pendientes`: usar `SchoolPeriodTransitionRule` para determinar grado destino; crear `Inscription` en ese grado y generar registros en `PendingSubject` para cada materia reprobada (máx 3). Estas materias se añaden como asignaturas adicionales en el siguiente periodo.
   - `aprobado` + `último grado`: marcar `graduatedAt` en `StudentPeriodOutcome` y no crear nueva inscripción.
3. Transferir relaciones auxiliares (representantes, contactos) según reglas actuales de inscripción.
4. Registrar todo en bitácora del `PeriodClosure`.

### 3.4. Finalización
- Si todo el proceso termina, `PeriodClosure` pasa a `closed` y se almacena snapshot JSON con métricas: aprobados, reprobados, pendientes por grado.
- En caso de error, se revierte la transacción y se marca `failed` con detalles para reintento.

## 4. API & Servicios Backend
| Servicio | Descripción |
|----------|-------------|
| `GET /api/periods/:id/closure-status` | Muestra estado, checklist y estadísticas previas al cierre. |
| `POST /api/periods/:id/close` | Dispara flujo de cierre (con opción `dryRun=true` para simulaciones). |
| `POST /api/periods/:id/recalculate` | Permite recalcular notas definitivas si se corrigen datos antes de cerrar. |
| `GET /api/periods/:id/outcomes` | Reporte por estudiante (para auditoría y entrega de boletines). |
| `POST /api/pending-subjects/:inscriptionId/resolve` | Marca una materia pendiente como aprobada una vez cursada en el nuevo periodo. |

Servicios internos:
- `PeriodClosureService`: orquestador principal.
- `FinalGradeCalculator`: encapsula lógica de sumatoria + puntos consejo.
- `StudentPromotionEngine`: aplica reglas de transición y reinscribe.
- `ChecklistService`: expone APIs para marcar Consejos de Curso completados antes del cierre.

## 5. Integración con Frontend
1. **Panel de Control del Periodo** (rol Master/Admin):
   - Vista del checklist (lapsos bloqueados, consejos completados, % calificaciones cargadas).
   - Botón “Cerrar periodo” (con confirmaciones y `dryRun`).
   - Reportes de resultados (gráficas y listados exportables).
2. **Módulo de Consejos de Curso** (Control de Estudios / Docentes):
   - UI para completar `CouncilChecklist` por sección.
   - Indicadores de materias con calificaciones faltantes.

## 6. Consideraciones Técnicas
- **Configurabilidad**: guardar nota mínima y máximo de materias pendientes en `SchoolPeriodTransitionRule` o en tabla `Settings` por institución.
- **Idempotencia**: `PeriodClosure` debe guardar hash de ejecución para evitar recalcular si ya está en `closed`.
- **Escalabilidad**: ejecutar cálculos por lotes (ej. secciones) con jobs en cola si la cantidad de alumnos es alta.
- **Auditoría**: conservar snapshots JSON (antes/después) para soportar reclamos posteriores.
- **Seguridad**: endpoints restringidos a roles `Master` y `Control de Estudios`.

## 7. Próximos Pasos
1. Crear migraciones para las tablas nuevas y columnas adicionales (si se elige esa ruta en lugar de tablas dedicadas).
2. Implementar servicios `PeriodClosureService`, `FinalGradeCalculator`, `StudentPromotionEngine`.
3. Construir UI del checklist y flujo de cierre.
4. Añadir pruebas unitarias/integración para los cálculos y reglas de transición.
5. Documentar procedimientos operativos (quién ejecuta el cierre, tiempos, backups previos).

## 8. Diseño de Datos Detallado

### 8.1 PeriodClosure
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `schoolPeriodId` | FK → `SchoolPeriod` | Periodo objetivo. |
| `status` | enum(`draft`,`validating`,`closed`,`failed`) | |
| `initiatedBy` | FK → `User` | Responsable de la acción. |
| `startedAt` / `finishedAt` | datetime | Marcas de tiempo. |
| `log` | JSON | Lista de eventos o errores. |
| `snapshot` | JSON | Métricas agregadas al cerrar. |

### 8.2 SubjectFinalGrade
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `inscriptionSubjectId` | FK → `InscriptionSubject` | Uno a uno. |
| `finalScore` | decimal(5,2) | Nota definitiva calculada. |
| `councilPoints` | decimal(4,2) | Puntos agregados. |
| `rawScore` | decimal(5,2) | Antes de puntos para auditoría. |
| `status` | enum(`aprobada`,`reprobada`) | |
| `calculatedAt` | datetime | Fecha del cálculo. |

### 8.3 StudentPeriodOutcome
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `inscriptionId` | FK → `Inscription` | Inscripción del periodo cerrado. |
| `finalAverage` | decimal(5,2) | Promedio entre materias. |
| `failedSubjects` | tinyint | Conteo. |
| `status` | enum(`aprobado`,`materias_pendientes`,`reprobado`) | |
| `promotionGradeId` | FK → `Grade` | Destino calculado (puede repetir). |
| `graduatedAt` | datetime nullable | Solo si terminó plan. |
| `metadata` | JSON | Información adicional (ej. razones de fallo). |

### 8.4 PendingSubject
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `newInscriptionId` | FK → `Inscription` | Inscripción del periodo siguiente. |
| `subjectId` | FK → `Subject` | Materia pendiente. |
| `originPeriodId` | FK → `SchoolPeriod` | De dónde proviene la deuda. |
| `status` | enum(`pendiente`,`aprobada`,`convalidada`) | |
| `resolvedAt` | datetime | Marca cuando se aprueba. |

### 8.5 SchoolPeriodTransitionRule
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `gradeFromId` | FK → `Grade` | Grado base. |
| `gradeToId` | FK → `Grade` | Grado al que asciende. |
| `minAverage` | decimal(4,2) | Nota mínima global. |
| `maxPendingSubjects` | tinyint | Límite de materias arrastrables. |
| `autoGraduate` | boolean | Indica si es último grado. |

### 8.6 CouncilChecklist
| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | PK | |
| `schoolPeriodId` | FK | |
| `gradeId` | FK | |
| `sectionId` | FK | |
| `termId` | FK | |
| `status` | enum(`open`,`in_review`,`done`) | |
| `completedBy` | FK → `User` | Responsable. |
| `completedAt` | datetime | |

## 9. Incrementos Backend
1. **Migraciones**  
   - Crear tablas descritas en §8.  
   - Agregar índices: `PeriodClosure.schoolPeriodId`, `SubjectFinalGrade.inscriptionSubjectId` (único), `PendingSubject.newInscriptionId`.  
   - Extender `Inscription` con campos `originOutcomeId` y `isRepeater`.
2. **Servicios/Capas**  
   1. `PeriodClosureService`  
      - Métodos: `requestClose(periodId, options)`, `dryRun(periodId)`, `resume(closureId)`.  
      - Orquesta validaciones, cálculo por lotes y reinscripción.  
   2. `ChecklistService`  
      - CRUD para `CouncilChecklist`.  
      - Hook que bloquea cierre si hay estados ≠ `done`.  
   3. `FinalGradeCalculator`  
      - Recibe `inscriptionId`, retorna `SubjectFinalGrade[]`.  
      - Expone función pura para pruebas unitarias.  
   4. `StudentPromotionEngine`  
      - Determina `StudentPeriodOutcome` + acciones (repetir, avanzar, graduar).  
      - Inserta `PendingSubject` según reglas.  
   5. `ReEnrollmentService`  
      - Encapsula la creación de nuevas inscripciones y copia de datos auxiliares.  
3. **Endpoints REST**  
   - `GET /api/periods/:id/closure-status` → usa Checklist + métricas.  
   - `POST /api/periods/:id/close?dryRun=true|false`.  
   - `GET /api/periods/:id/outcomes` (paginado, filtros por estado).  
   - `GET /api/periods/:id/pending-subjects` para control de Estudios.  
   - `POST /api/pending-subjects/:id/resolve`.  
   - `GET /api/periods/:id/checklist` y `POST /api/periods/:id/checklist` para actualizar estados.
4. **Jobs / Cola opcional**  
   - Si la cantidad de alumnos es alta, enviar cálculos a BullMQ/Agenda y notificar vía websockets una vez listo.
5. **Testing**  
   - Unit tests para `FinalGradeCalculator` y `StudentPromotionEngine`.  
   - Integration tests simulando cierre completo (datos semilla).

## 10. Incrementos Frontend
1. **Panel de Periodos (Master/Admin)**  
   - Vista por periodo con checklist (lapsos bloqueados, consejos completados, % notas cargadas).  
   - Botón para `Simular cierre` (dry-run) y `Cerrar definitivamente`.  
   - Tabla de resultados con filtros (grado, estado, materias pendientes).  
   - Exportación CSV/PDF.
2. **Consejos de Curso UI (Control de Estudios)**  
   - Checklist interactivo por sección/lapso.  
   - Alertas cuando faltan calificaciones o puntos.  
3. **Gestión de Materias Pendientes**  
   - En `EnrolledStudents` o módulo nuevo mostrar badges de materias arrastradas.  
   - Modal para marcar materia como aprobada (consume endpoint `resolve`).  
4. **Notificaciones**  
   - Banner en dashboard avisando que existe cierre en progreso o fallido.  
5. **UX Consideraciones**  
   - Confirmaciones con resumen de impacto (ej. “120 estudiantes serán reinscritos”).  
   - Mostrar historias auditables (bitácora del `PeriodClosure`).

## 11. Backlog Recomendado
1. **Sprint 1 – Fundaciones**  
   - Migraciones §8.  
   - ChecklistService + endpoints.  
   - UI mínima para marcar consejos completos.
2. **Sprint 2 – Cálculo de notas**  
   - FinalGradeCalculator + SubjectFinalGrade persistente.  
   - Reporte backend `GET /outcomes`.  
   - Pruebas unitarias del cálculo.
3. **Sprint 3 – Reinscripción automática**  
   - StudentPromotionEngine + ReEnrollmentService.  
   - PendingSubject endpoints + UI de arrastres.  
   - Integraciones con asignación de materias agrupadas.
4. **Sprint 4 – Orquestación de cierre**  
   - PeriodClosureService + endpoints `close/dryRun`.  
   - Panel administrativo con flujos completos.  
   - Notificaciones y bitácora.
5. **Sprint 5 – Pulido y auditoría**  
   - Exportables, dashboards y métricas.  
   - Automatización de pruebas E2E (cierre completo).  
   - Manual operativo y documentación para usuarios finales.
