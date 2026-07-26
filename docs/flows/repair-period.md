# Plan: Período de Reparación / Revisión

> **Estado**: Plan de implementacion. No hay codigo escrito.
>
> Documento de referencia para agentes de IA y desarrolladores que implementen
> esta funcionalidad.

---

## 1. Objetivo

Permitir que los estudiantes con materias aplazadas (reprobadas) tengan una
oportunidad de reparar sus notas **antes** del cierre definitivo del periodo
escolar. Si aprueban en reparacion, se inscriben como alumnos regulares al
siguiente grado. Si no, siguen el flujo normal de `materias_pendientes` o
`reprobado`.

---

## 2. Ciclo de vida del periodo escolar (nuevo flujo)

```
Lapso 1 ──► Lapso 2 ──► Lapso 3 ──► Consejos de Curso ──► Período de
                                                           Reparación ──► Cierre de
                                                                           Período
```

**Antes** (implementado actualmente):
```
Lapso 1 ──► Lapso 2 ──► Lapso 3 ──► Consejos de Curso ──► Cierre de Período
```

---

## 3. Modelos nuevos

### 3.1 `RevisionPeriod`

Tabla: `revision_periods`

Representa una ventana de reparacion dentro de un `SchoolPeriod`.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `schoolPeriodId` | INTEGER FK | Periodo escolar al que pertenece |
| `status` | ENUM('pending','open','closed') | `pending` = no abierto aun; `open` = activo; `closed` = finalizado |
| `maxOpportunities` | INTEGER | Numero maximo de oportunidades de reparacion (default 3) |
| `passingGrade` | DECIMAL(5,2) | Nota minima para aprobar la reparacion (hereda `settings.passing_grade`) |
| `openedAt` | DATE | Cuando se abrio |
| `closedAt` | DATE | Cuando se cerro |
| `createdAt` | DATE | |
| `updatedAt` | DATE | |

**Reglas**:
- Solo puede haber **un** `RevisionPeriod` por `SchoolPeriod`.
- `status` solo puede cambiar en orden: `pending -> open -> closed`.
- Solo se puede abrir si todos los terminos del periodo estan bloqueados
  y **todos** los `CouncilChecklist` tienen `status = 'done'`.

### 3.2 `InscriptionSubjectRevision`

Tabla: `inscription_subject_revisions`

Cada intento de reparacion de una materia por un estudiante.

| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | INTEGER PK | |
| `revisionPeriodId` | INTEGER FK | Periodo de reparacion |
| `inscriptionSubjectId` | INTEGER FK | Materia que se repara |
| `opportunity` | INTEGER | Numero de oportunidad (1, 2, 3) |
| `score` | DECIMAL(5,2) nullable | Nota obtenida |
| `status` | ENUM('pending','approved','failed') | `pending` = sin calificar; `approved` = aprobo; `failed` = reprobo |
| `gradedBy` | INTEGER FK (Person) | Profesor que califico |
| `gradedAt` | DATE | Fecha de calificacion |
| `createdAt` | DATE | |
| `updatedAt` | DATE | |

**Reglas**:
- UNIQUE(`revisionPeriodId`, `inscriptionSubjectId`, `opportunity`)
- La nota final de reparacion para una materia es el **maximo** entre todas las
  oportunidades (`MAX(score)`).
- Si `score >= passingGrade`, `status = 'approved'`.
- Si `score < passingGrade`, `status = 'failed'`.
- Solo se califica si el `RevisionPeriod.status = 'open'`.

---

## 4. Cambios a modelos existentes

### 4.1 `CouncilChecklist` — Nuevo estado

Agregar `'revision'` al ENUM de `status`:

```
ENUM('open','in_review','done','revision')
```

- `'revision'` indica que el consejo de curso determino que un estudiante debe
  ir a reparacion en ciertas materias.
- La transicion es: `in_review -> done` (todos pasaron) o `in_review -> revision`
  (hay estudiantes a reparacion).

### 4.2 `SubjectFinalGrade.gradeType` — Usar los valores existentes

Ya existen `'revision'` y `'revision_materia_pendiente'` en el ENUM. Durante el
calculo de notas finales del periodo de reparacion, se deben usar:

| Situacion | gradeType |
|-----------|-----------|
| Estudiante reprobo en lapso regular, reparo y aprobo | `'revision'` |
| Estudiante reprobo en lapso regular, reparo y NO aprobo | `'regular'` (mantiene la original) |
| Estudiante con materia pendiente que reparo y aprobo | `'revision_materia_pendiente'` |

---

## 5. Backend — Controladores nuevos

### 5.1 `revisionPeriodController.ts`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/api/revision-periods/:schoolPeriodId` | Obtener o crear el RevisionPeriod |
| `POST` | `/api/revision-periods/:schoolPeriodId/open` | Abrir el periodo de reparacion |
| `POST` | `/api/revision-periods/:schoolPeriodId/close` | Cerrar el periodo de reparacion |
| `GET` | `/api/revision-periods/:schoolPeriodId/students` | Listar estudiantes con materias a reparar |
| `GET` | `/api/revision-periods/:schoolPeriodId/grades` | Obtener todas las notas de reparacion |
| `PUT` | `/api/revision-periods/:id/revisions/bulk` | Guardar notas masivamente |
| `PUT` | `/api/revision-periods/:id/revisions/:revisionId` | Guardar una nota individual |

### 5.2 `revisionGradeController.ts` (o integrarlo en `evaluationController.ts`)

Endpoints para que el profesor vea y califique las reparaciones de sus materias
asignadas.

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| `GET` | `/api/revision-grades/my-assignments` | Materias del profesor con estudiantes a reparar |
| `GET` | `/api/revision-grades/my-assignments/:periodGradeSubjectId` | Detalle: lista de estudiantes y sus oportunidades |
| `PUT` | `/api/revision-grades/:revisionId` | Guardar nota de reparacion |

---

## 6. Backend — Servicios nuevos

### 6.1 `revisionPeriodService.ts`

Logica de negocio para el ciclo de vida del periodo de reparacion.

```
openRevisionPeriod(schoolPeriodId, transaction?)
- Valida que todos los CouncilChecklist esten en 'done'
- Crea/actualiza RevisionPeriod con status='open'
- Crea InscriptionSubjectRevision (opportunity=1, status='pending')
  para cada materia reprobada de cada estudiante
```

```
closeRevisionPeriod(schoolPeriodId, transaction?)
- Valida que todas las revisiones tengan score (no 'pending')
- Cambia status a 'closed'
```

### 6.2 `revisionGradeService.ts`

Logica de negocio para las notas de reparacion.

```
calculateRepairFinalScore(inscriptionSubjectId, revisionPeriodId): number | null
- Obtiene MAX(score) de todas las oportunidades
```

```
applyRepairGrades(schoolPeriodId, transaction?)
- Para cada estudiante con reparaciones:
  - Calcula MAX(score) por materia
  - Si MAX(score) >= passingGrade: crea/actualiza SubjectFinalGrade
    con gradeType='revision' y status='aprobada'
- Este servicio se llama desde finalGradeCalculator o desde el executor
  de cierre
```

---

## 7. Cambios a servicios existentes

### 7.1 `periodClosureExecutor.ts`

**Validacion adicional** (`validateClosure`):
- `RevisionPeriod` debe existir con `status = 'closed'` O no debe haber
  estudiantes con materias reprobadas.

**Calculo de notas** (antes de `FinalGradeCalculator`):
- Llamar a `applyRepairGrades()` para que las notas de reparacion
  sobrescriban las originales si son mayores.

**Logica de promocion**:
- Sin cambios. El `StudentPromotionEngine` ya clasifica basado en
  `SubjectFinalGrade.finalScore`. Si la nota de reparacion es mayor que
  la original y >= passingGrade, el estudiante pasa de `reprobado` a
  `aprobado` o `materias_pendientes`.

### 7.2 `finalGradeCalculator.ts`

Agregar un paso opcional que permita inyectar notas de reparacion:

```typescript
interface FinalGradeOptions {
  repairGrades?: Map<number, number>; // inscriptionSubjectId -> repairScore
}
```

Si `repairGrades` tiene una entrada para un `InscriptionSubject`:
- Usar `Math.max(originalScore, repairGrade)` como nota final.
- Marcar `gradeType = 'revision'` si la nota de reparacion es la que queda.

### 7.3 `periodClosureService.ts`

Agregar al metodo `getClosureStatus()` informacion sobre el estado del
periodo de reparacion.

---

## 8. Backend — Rutas

Registrar en `backend/src/app.ts`:

```typescript
import revisionPeriodRoutes from './routes/revisionPeriodRoutes';
import revisionGradeRoutes from './routes/revisionGradeRoutes';

app.use('/api/revision-periods', revisionPeriodRoutes);
app.use('/api/revision-grades', revisionGradeRoutes);
```

---

## 9. Frontend — Paginas nuevas

### 9.1 `control-estudios/RepairPeriodManagement.tsx`

> Acceso: `Control de Estudios`, `Administrador`, `Master`

**Proposito**: Gestionar el ciclo de vida del periodo de reparacion.

**Componentes**:
1. **Estado del periodo**: Muestra si esta `pending`, `open` o `closed`.
2. **Boton "Abrir periodo de reparacion"**: Disponible cuando los consejos
   de curso estan completos. Llama a `POST /open`.
3. **Tabla de estudiantes en reparacion**: Muestra grado, seccion, estudiante,
   materias reprobadas, oportunidades usadas y notas.
4. **Boton "Cerrar periodo de reparacion"**: Disponible cuando todas las
   revisiones estan calificadas. Llama a `POST /close`.
5. **Resumen**: Cuantos estudiantes repararon, cuantos aprobaron, cuantos no.

### 9.2 `teacher/RepairGradesPanel.tsx`

> Acceso: `Profesor`

**Proposito**: El profesor ingresa las notas de reparacion de sus estudiantes.

**Componentes**:
1. **Selector de materia/seccion**: Solo muestra las asignaciones del profesor
   que tienen estudiantes en reparacion.
2. **Tabla de estudiantes**: Por cada estudiante, muestra:
   - Nombre del estudiante
   - Materia a reparar
   - Nota original reprobada
   - Hasta 3 columnas de oportunidades (InputNumber)
   - La nota maxima de reparacion calculada automaticamente
3. **Guardar**: `PUT /api/revision-grades/bulk`

---

## 10. Frontend — Cambios a componentes existentes

### 10.1 `control-estudios/CourseCouncil.tsx`

Agregar despues del wizard de consejos de curso:

- **Seccion "Derivar a reparacion"**: Checkbox por estudiante/materia para
  marcar que va a reparacion. Esto actualiza `CouncilChecklist.status` a
  `'revision'` en vez de `'done'`.

*Alternativa simplificada*: Si no se quiere modificar la UI del consejo,
simplemente se asume que cualquier materia con nota < passingGrade va a
reparacion automaticamente. No se necesita el flag.

### 10.2 `Sidebar` de `ControlEstudiosLayout.tsx`

Agregar item de menu:

```tsx
{
  key: '/control-estudios/reparacion',
  icon: <ToolOutlined />,
  label: 'Reparacion',
}
```

### 10.3 `App.tsx`

Agregar ruta:

```tsx
<Route path="/control-estudios/reparacion" element={<RepairPeriodManagement />} />
<Route path="/profesor/reparacion" element={<RepairGradesPanel />} />
```

---

## 11. Migraciones necesarias

### 11.1 Crear tabla `revision_periods`

```sql
CREATE TABLE revision_periods (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  schoolPeriodId INTEGER NOT NULL,
  status ENUM('pending','open','closed') NOT NULL DEFAULT 'pending',
  maxOpportunities INTEGER NOT NULL DEFAULT 3,
  passingGrade DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  openedAt DATE NULL,
  closedAt DATE NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (schoolPeriodId) REFERENCES school_periods(id),
  UNIQUE KEY (schoolPeriodId)
);
```

### 11.2 Crear tabla `inscription_subject_revisions`

```sql
CREATE TABLE inscription_subject_revisions (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  revisionPeriodId INTEGER NOT NULL,
  inscriptionSubjectId INTEGER NOT NULL,
  opportunity INTEGER NOT NULL DEFAULT 1,
  score DECIMAL(5,2) NULL,
  status ENUM('pending','approved','failed') NOT NULL DEFAULT 'pending',
  gradedBy INTEGER NULL,
  gradedAt DATE NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (revisionPeriodId) REFERENCES revision_periods(id),
  FOREIGN KEY (inscriptionSubjectId) REFERENCES inscription_subjects(id),
  FOREIGN KEY (gradedBy) REFERENCES people(id),
  UNIQUE KEY (revisionPeriodId, inscriptionSubjectId, opportunity)
);
```

### 11.3 Modificar ENUM de `CouncilChecklist.status`

```sql
ALTER TABLE council_checklists
  MODIFY COLUMN status ENUM('open','in_review','done','revision') NOT NULL DEFAULT 'open';
```

---

## 12. Settings nuevas

| Key | Default | Descripcion |
|-----|---------|-------------|
| `revision_max_opportunities` | `3` | Numero maximo de oportunidades de reparacion |
| `revision_passing_grade` | `10` | Nota minima para aprobar reparacion (hereda `passing_grade`) |
| `revision_max_grade` | `20` | Nota maxima posible en reparacion (hereda `max_grade`) |

*Nota*: `revision_passing_grade` y `revision_max_grade` pueden simplemente
heredar los valores de `passing_grade` y `max_grade` existentes. Las settings
separadas permiten override si se necesita.

---

## 13. Flujo completo — Ejemplo

### Escenario: Estudiante "Juan" reprueba Matematica (nota 08) y Fisica (nota 07)

1. **Lapsos regulares**: Juan obtiene notas en todas sus materias.
2. **Consejos de curso**: Se revisan los casos. Juan reprueba 2 materias.
3. **Apertura de reparacion** (Control de Estudios):
   - Se abre el `RevisionPeriod`.
   - Se crean `InscriptionSubjectRevision` (opportunity=1, status=pending)
     para Matematica y Fisica.
4. **Profesor califica** (Profesor → RepairGradesPanel):
   - Profesor de Matematica coloca nota de reparacion: **12** (aprobado).
   - Profesor de Fisica coloca nota de reparacion: **06** (reprobado).
   - Opportunity 1 se consume. Como Fisica sigue reprobada, se crea
     opportunity=2 automaticamente (si `maxOpportunities` lo permite).
5. **Segunda oportunidad** Fisica:
   - Profesor coloca nota: **11** (aprobado).
6. **Cierre de reparacion** (Control de Estudios):
   - `RevisionPeriod.status = 'closed'`.
7. **Cierre de periodo** (Control de Estudios):
   - `applyRepairGrades()` ejecuta: Matematica 12 >= 10 → `status='aprobada'`,
     Fisica 11 >= 10 → `status='aprobada'`.
   - Juan ahora tiene 0 materias reprobadas → `aprobado`.
   - Se inscribe como alumno regular en el siguiente grado.

---

## 14. Orden de implementacion sugerido

| Fase | Tareas | Depende de |
|------|--------|------------|
| **Fase 1** | Modelos: `RevisionPeriod`, `InscriptionSubjectRevision` + migraciones | — |
| **Fase 2** | `revisionPeriodService.ts` (open/close) | Fase 1 |
| **Fase 3** | `revisionPeriodController.ts` (endpoints CRUD) | Fase 2 |
| **Fase 4** | `revisionGradeService.ts` + `revisionGradeController.ts` | Fase 1 |
| **Fase 5** | Frontend `RepairPeriodManagement.tsx` | Fase 3 |
| **Fase 6** | Frontend `RepairGradesPanel.tsx` (profesor) | Fase 4 |
| **Fase 7** | Integracion en `finalGradeCalculator.ts` + `periodClosureExecutor.ts` | Fase 2, Fase 4 |
| **Fase 8** | Sidebar + App.tsx routes | Fase 5, Fase 6 |
| **Fase 9** | Modificar `CouncilChecklist.status` ENUM | Fase 1 |

---

## 15. Notas para el implementador

### Convenciones
- Idioma del codigo/comentarios: **ingles**
- Idioma de la UI: **espanol**
- TypeScript modo estricto, evitar `any`.
- Modelos Sequelize: definicion en archivo separado, asociaciones solo en `index.ts`.
- Controladores: funciones async `(req, res)`, transacciones con `sequelize.transaction()`.

### Reglas de negocio importantes
- Los estudiantes **aprobados no participan** en reparacion.
- Cada materia reprobada genera automaticamente `opportunity=1`.
- El profesor coloca la nota. Si `score >= passingGrade`, `status='approved'`
  y no se generan mas oportunidades para esa materia.
- Si `score < passingGrade`, `status='failed'` y se genera la siguiente
  oportunidad (hasta `maxOpportunities`).
- La nota final de reparacion es `MAX(score)` de todas las oportunidades.
- El `RevisionPeriod` solo se puede cerrar si NO hay registros con
  `status='pending'`.
- Si un estudiante no se presenta a ninguna oportunidad, su status queda
  `'pending'`. Al cerrar, esas pasan a `'failed'` automaticamente.

### Valores existentes a reutilizar
- `SubjectFinalGrade.gradeType`: ya tiene `'revision'` y
  `'revision_materia_pendiente'`.
- `Setting`: `passing_grade` (default 10), `max_grade` (default 20).
- `CouncilChecklist`: extender ENUM para incluir `'revision'`.

### Archivos clave de referencia

| Archivo | Proposito |
|---------|-----------|
| `backend/src/services/periodClosureExecutor.ts` | Donde se integra la logica de reparacion al cierre |
| `backend/src/services/studentPromotionEngine.ts` | Clasifica estudiantes (no requiere cambios) |
| `backend/src/services/finalGradeCalculator.ts` | Donde se factorizan las notas de reparacion |
| `backend/src/models/SubjectFinalGrade.ts` | Modelo con `gradeType` listo para reparacion |
| `frontend/src/pages/control-estudios/PerformanceSummary.tsx` | Patron de tabs/export |
| `frontend/src/pages/teacher/TeacherPanel.tsx` | Patron de panel de profesor |
| `docs/flows/period-closure.md` | Documentacion del cierre actual |

---

*Plan creado Julio 2026. Basado en analisis completo del codigo existente.*
