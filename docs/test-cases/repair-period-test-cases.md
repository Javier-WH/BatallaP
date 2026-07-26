# Esquema de Casos de Uso — Período de Reparación

> **Objetivo**: Pruebas de caja negra y de usuario (UAT).
>
> Cada caso de uso tiene precondiciones, flujo principal, flujos alternativos
> y verificaciones observables en la UI/BD.

---

## Actores

| Actor | Rol | Acceso |
|-------|-----|--------|
| **CE** | Control de Estudios | Gestiona apertura/cierre del período de reparación, ve todos los estudiantes |
| **Profesor** | Profesor | Ingresa notas de reparación de sus materias asignadas |
| **Alumno** | Estudiante | No interactúa con el módulo (solo ve sus notas finales) |

---

## CU-01: Abrir período de reparación

**Actor**: CE

**Precondiciones**:
- Existe un período escolar activo
- Los 3 lapsos están bloqueados (`isBlocked = true`)
- Se ejecutaron los 3 consejos de curso (`CouncilChecklist.status = 'done'` para cada lapso)
- Hay al menos 1 estudiante con materia reprobada (`SubjectFinalGrade.status = 'reprobada`)

**Flujo principal**:
1. CE navega a `/control-estudios/reparacion`
2. El sistema muestra el estado `Pendiente` y los consejos completos (3/3)
3. CE presiona **"Abrir período de reparación"**
4. El sistema cambia el estado a `Abierto`
5. El sistema crea `InscriptionSubjectRevision` (oportunidad=1, status=pending) para cada materia reprobada

**Verificaciones**:
- [ ] Estado cambia de `Pendiente` → `Abierto` en la UI
- [ ] La tabla `inscription_subject_revisions` tiene registros con `status = 'pending'`
- [ ] La tabla `revision_periods` tiene `openedAt` no nulo
- [ ] El profesor ve sus materias en `/profesor/reparacion`

**Flujos alternativos**:

| # | Condición | Resultado esperado |
|---|-----------|-------------------|
| CU-01a | Faltan consejos de curso (ej. 2/3) | Botón deshabilitado, mensaje: "Todos los consejos deben estar completos" |
| CU-01b | No hay estudiantes reprobados | El período abre pero se crean 0 revisiones. Contador = 0 |
| CU-01c | El período ya está abierto | Error: "El período de reparación ya está abierto" |
| CU-01d | El período ya fue cerrado | Error: "El período de reparación ya fue cerrado" |
| CU-01e | Hay lapsos sin bloquear | Error: "Todos los lapsos deben estar bloqueados" |

---

## CU-02: Profesor ingresa nota de reparación

**Actor**: Profesor

**Precondiciones**:
- El período de reparación está `Abierto`
- El profesor tiene materias asignadas con estudiantes reprobados
- Existen registros en `InscriptionSubjectRevision` con `status = 'pending'`

**Flujo principal (oportunidad 1, aprueba)**:
1. Profesor navega a `/profesor/reparacion`
2. Selecciona una materia del dropdown (ej. "Matemática — 1er Año B")
3. Ve la lista de estudiantes con nota original reprobada
4. Para el estudiante "Juan Pérez" (original: 08), ingresa **12** en Oportunidad 1
5. Presiona **"Guardar notas"**
6. El sistema guarda: `score = 12, status = 'approved'`
7. El tag cambia a verde **"Aprobado"**
8. **No** se crea Oportunidad 2 para esa materia

**Verificaciones**:
- [ ] `InscriptionSubjectRevision.score = 12`
- [ ] `InscriptionSubjectRevision.status = 'approved'`
- [ ] `InscriptionSubjectRevision.gradedBy` = ID del profesor
- [ ] `InscriptionSubjectRevision.gradedAt` tiene fecha/hora
- [ ] No existe registro con `opportunity = 2` para ese `inscriptionSubjectId`

**Flujo alternativo (oportunidad 1, reprueba)**:
1. Profesor ingresa **05** (debajo del passingGrade=10)
2. Presiona Guardar
3. Status = `'failed'`, tag rojo **"Reprobado"**
4. El sistema crea automáticamente Oportunidad 2 con `status = 'pending'`

**Verificaciones**:
- [ ] Oportunidad 1: `score = 5, status = 'failed'`
- [ ] Oportunidad 2: creada con `status = 'pending'`, `score = null`

**Flujo alternativo (oportunidad 2, aprueba)**:
1. Profesor ingresa **11** en Oportunidad 2
2. Guarda → `status = 'approved'`
3. No se crea Oportunidad 3

**Verificaciones**:
- [ ] Oportunidad 2: `score = 11, status = 'approved'`

---

## CU-03: Múltiples oportunidades hasta el máximo

**Actor**: Profesor

**Precondiciones**: `maxOpportunities = 3`

**Flujo**:
1. Oportunidad 1: Profesor ingresa 05 → `failed`, se crea Op2
2. Oportunidad 2: Profesor ingresa 06 → `failed`, se crea Op3
3. Oportunidad 3: Profesor ingresa 09 → `failed`
4. No se crea Oportunidad 4 (llegó al máximo)

**Verificaciones**:
- [ ] Existen 3 registros para ese `inscriptionSubjectId`
- [ ] No existe oportunidad 4
- [ ] Después de fallar Op3, el estudiante queda con 3 `failed`

---

## CU-04: Cerrar período de reparación

**Actor**: CE

**Precondiciones**:
- El período está `Abierto`
- Puede haber revisiones `pending`

**Flujo principal**:
1. CE presiona **"Cerrar período de reparación"**
2. El sistema auto-falla todas las revisiones con `status = 'pending'` → `'failed'`
3. Para cada materia con failedCount < maxOpportunities, crea la siguiente oportunidad (quedan `pending` para el próximo intento... wait, no — eso solo en `saveRevisionGrade`. En close, solo falla las pendientes y no crea nuevas.)

**Corrección**: Al cerrar, SOLO se cambian las `pending` a `failed`. NO se crean nuevas oportunidades. Las nuevas oportunidades solo se crean al guardar una nota fallida durante el período abierto.

**Verificaciones**:
- [ ] Estado cambia a `Cerrado`
- [ ] `revision_periods.closedAt` tiene fecha/hora
- [ ] Todas las revisiones con `status = 'pending'` pasan a `'failed'`
- [ ] Las revisiones que ya tenían `approved` o `failed` no se modifican

**Flujos alternativos**:

| # | Condición | Resultado |
|---|-----------|-----------|
| CU-04a | Período ya cerrado | Error: "El período de reparación no está abierto" |
| CU-04b | No existe período de reparación | Error: "No existe un período de reparación" |

---

## CU-05: Cierre de período escolar aplica notas de reparación

**Actor**: CE

**Precondiciones**:
- `RevisionPeriod.status = 'closed'`
- Existen revisiones con `status = 'approved'` y `status = 'failed'`
- El período escolar está activo

**Flujo principal**:
1. CE ejecuta el cierre de período (`POST /api/period-closure/:id/execute`)
2. El sistema valida que `RevisionPeriod` esté cerrado (si existe)
3. `applyRepairGrades` calcula `MAX(score)` por `inscriptionSubjectId`
4. Actualiza `SubjectFinalGrade`:
   - `originalScore` = nota original reprobada
   - `originalStatus` = `'reprobada'`
   - `finalScore` = nota de reparación
   - `status` = según si >= passingGrade
   - `gradeType` = `'revision'`
5. `FinalGradeCalculator` y `StudentPromotionEngine` usan las nuevas notas

**Verificaciones**:

| Caso | Nota original | Mejor reparación | finalScore | status | gradeType |
|------|--------------|-----------------|------------|--------|-----------|
| Aprobó en reparación | 08 | 12 (Op2) | 12 | `aprobada` | `revision` |
| Reprobó en reparación | 07 | 05 (Op1), 06 (Op2) | 06 | `reprobada` | `revision` |
| No se presentó (pending → failed) | 08 | — | 08 | `reprobada` | `regular` (sin cambios) |

- [ ] Estudiante que aprobó en reparación → promovido como `aprobado` (si no tiene otras reprobadas)
- [ ] Estudiante que no aprobó en reparación → sigue flujo normal (`materias_pendientes` o `reprobado`)

**Flujos alternativos**:

| # | Condición | Resultado |
|---|-----------|-----------|
| CU-05a | RevisionPeriod está `open` | Error: "El período de reparación debe estar cerrado" |
| CU-05b | No hay RevisionPeriod (nadie reprobó) | El cierre procede normalmente sin aplicar reparaciones |
| CU-05c | Estudiante aprobó todas las reparaciones | Pasa de `reprobado` a `aprobado`, se inscribe como regular en siguiente grado |

---

## CU-06: Validación de permisos y acceso

**Actor**: CE, Profesor, Admin, Master

**Precondiciones**: Usuario logueado

| # | Actor | Ruta | Resultado |
|---|-------|------|-----------|
| CU-06a | CE | `/control-estudios/reparacion` | Accede, ve gestión completa |
| CU-06b | Admin | `/control-estudios/reparacion` | Accede (allowedRoles incluye Admin) |
| CU-06c | Master | `/control-estudios/reparacion` | Accede (allowedRoles incluye Master) |
| CU-06d | Profesor | `/control-estudios/reparacion` | **Denegado** (no tiene rol CE/Admin/Master) |
| CU-06e | Profesor | `/profesor/reparacion` | Accede, ve solo sus materias |
| CU-06f | Representante | `/profesor/reparacion` | **Denegado** |
| CU-06g | Alumno | `/profesor/reparacion` | **Denegado** |

---

## CU-07: Estudiante sin reparaciones — flujo completo integrado

**Actor**: CE (orquesta), Profesor (califica)

**Escenario**: Estudiante **María** reprueba Castellano (08), pero es la única.

**Precondiciones**:
- Período activo, 3 lapsos bloqueados, 3 consejos `done`
- María tiene 1 `SubjectFinalGrade` con `status = 'reprobada'` (Castellano, 08)

**Flujo completo**:

| Paso | Actor | Acción | Verificación |
|------|-------|--------|-------------|
| 1 | CE | Abre período de reparación | Se crea `InscriptionSubjectRevision` para Castellano (Op1, pending) |
| 2 | Profesor | Entra a `/profesor/reparacion`, selecciona Castellano | Ve a María con original=08, Op1 pendiente |
| 3 | Profesor | Ingresa 12 en Op1, guarda | Op1: approved. No se crea Op2 |
| 4 | CE | Cierra período de reparación | Status = closed. Ningún cambio en revisiones (ya estaban calificadas) |
| 5 | CE | Ejecuta cierre de período | SubjectFinalGrade: finalScore=12, originalScore=08, gradeType=revision, status=aprobada |
| 6 | Sistema | Evalúa promoción | María: 0 reprobadas → `aprobado` |
| 7 | Sistema | Crea inscripción siguiente grado | Nueva inscripción como regular |

---

## CU-08: Edge cases — Casos límite

| # | Escenario | Resultado esperado |
|---|-----------|-------------------|
| CU-08a | Estudiante reprueba todas las materias (ej. 8 de 8). **Sin límite de cantidad.** | Se crean 8 revisiones (Op1). El profesor puede aprobar algunas y reprobar otras. Si aprueba las 8, es promovido como regular |
| CU-08b | Estudiante reprueba, no se presenta a reparación (queda pending en todas) | Al cerrar, todas pasan a failed. Al ejecutar cierre, mantiene notas originales. Sigue como `reprobado` |
| CU-08c | Profesor guarda nota vacía (borra el input) | `score = null, status = 'pending'`. No se crea nueva oportunidad |
| CU-08d | Profesor guarda nota = 0 | `score = 0, status = 'failed'` (0 < passingGrade). Se crea siguiente oportunidad |
| CU-08e | Profesor guarda nota = passingGrade exacto (ej. 10) | `score = 10, status = 'approved'` (>= passingGrade) |
| CU-08f | Dos profesores califican la misma materia (diferentes secciones) | Cada uno ve solo los estudiantes de su sección. Sin conflictos |
| CU-08g | CE intenta abrir período sin período activo | Error: "No hay un período activo" (el frontend no muestra datos) |
| CU-08h | Estudiante con SubjectFinalGrade sin finalScore (null) | No se crea revisión para ese estudiante (solo se crean para status='reprobada') |

---

## Resumen de verificaciones rápidas UAT

- [ ] CE ve el estado del período y los consejos completos
- [ ] CE puede abrir el período solo si los 3 consejos están `done`
- [ ] CE ve la tabla de estudiantes con materias reprobadas, revisiones y estados
- [ ] CE puede cerrar el período; las pendientes pasan a `failed`
- [ ] Profesor ve solo sus materias con estudiantes reprobados
- [ ] Profesor ingresa nota → status cambia según >= passingGrade
- [ ] Si aprueba → no se crea siguiente oportunidad
- [ ] Si reprueba → se crea automáticamente siguiente oportunidad (hasta maxOpportunities)
- [ ] Al cerrar el período escolar, `applyRepairGrades` reemplaza notas originales
- [ ] Nota original se preserva en `originalScore` / `originalStatus`
- [ ] `gradeType = 'revision'` en SubjectFinalGrade para materias reparadas
- [ ] Estudiantes que aprobaron en reparación → promovidos como regulares
- [ ] Permisos: CE/Admin/Master acceden a gestión; Profesor solo a sus materias; otros denegados

---

*Documento de testing — Julio 2026. Usar junto con `docs/flows/repair-period.md`.*
