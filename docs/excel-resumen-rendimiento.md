# Excel — Resumen de Rendimiento Estudiantil

> Planilla de calificaciones por sección generada desde `exportPerformanceSummary` en `performanceSummaryController.ts`.

---

## Vista general

Es una planilla en formato `.xlsx` que lista todos los estudiantes de una misma **sección**, con sus datos personales y la **calificación definitiva** de cada materia. Soporta materias con **notas numéricas** (0-20) y **notas literales** (A, B, C… según escala configurable).

El archivo se genera por: `período escolar + grado + sección`.

---

## Hojas

La plantilla base tiene 4 hojas (`1er Año`, `3er Año`, `4to Año`, `5to Año`). Al exportar:

1. Se determina qué hoja usar según `grade.order` (1→`1er Año`, 2→`1er Año`, 3→`3er Año`, 4→`4to Año`, 5→`5to Año`).
2. Se **clona** la hoja tantas veces como sea necesario para cubrir a los estudiantes.
3. Las hojas sobrantes se **eliminan** del workbook final.

Los estudiantes se dividen en dos grupos:
- **Regulares** — aprobaron todas las materias (score ≥ `passing_grade`, default 10).
- **REVISIÓN DE MATERIA PENDIENTE** — tienen al menos una materia reprobada.

Cada grupo va en hojas separadas. Si un grupo tiene más de 35 estudiantes, se generan páginas adicionales: `1er Año (Regulares 2)`, `1er Año (REVISION 2)`, etc.

---

## Columnas de materias (`subj_*`)

Las materias académicas se muestran en orden canónico (definido por `subjectOrderMap`, usando `PeriodGradeSubject.order`).

La plantilla base tiene `subj_1` … `subj_9` (hasta 9 materias). Si el grado tiene **más de 9 materias**, el sistema:

1. Detecta que no hay más named ranges `subj_10`, `subj_11`…
2. **Agrega columnas automáticamente** a la derecha de la última columna existente.
3. Escribe la abreviatura en el encabezado (fila 15).
4. Agrega los bordes correspondientes en las filas de datos.

> Solo funciona para plantillas cuyo nombre empiece con `resumenFinal` (ej. `resumenFinal_template_.xlsx`, `ResumenFinal_Template.xlsx`). Para plantillas personalizadas, si no existe `subj_i`, esa materia no se renderiza.

---

## Named ranges

### Institución / encabezado

| Nombre | Descripción |
|---|---|
| `inst_period` | Nombre del período escolar (ej. 2024-2025) |
| `inst_code` | Código DEA |
| `inst_education_code` | Código del nivel educativo |
| `inst_level` | Nivel/modalidad |
| `inst_name` | Nombre de la institución |
| `inst_address` | Dirección |
| `inst_phone` | Teléfono |
| `inst_municipality` | Municipio |
| `inst_state` | Estado |
| `inst_cdcee` | Código CDCEE |
| `inst_director` | Nombre del director |
| `inst_director_doc` | Documento del director |
| `inst_grade` | Nombre del grado |
| `inst_section` | Nombre de la sección |
| `inst_eval_type` | "Regulares" o "REVISION DE MATERIA PENDIENTE" |

### Cabecera de materias

| Nombre | Descripción |
|---|---|
| `subj_i` | Abreviatura de la i-ésima materia en orden canónico (escrito en la fila de encabezado, ej. fila 15). |
| `subjname_i` | Nombre completo de la i-ésima materia (si existe el named range). |

### Datos del estudiante (por fila)

Para cada estudiante en la fila `n` (1 a 35):

| Nombre | Descripción |
|---|---|
| `std_num_n` | Número de lista (01, 02…) |
| `std_doc_n` | Cédula con prefijo (V-12345678, E-…) |
| `std_ln_n` | Apellidos |
| `std_fn_n` | Nombres |
| `std_bp_n` | Municipio de nacimiento |
| `std_ef_n` | Estado de nacimiento (abreviatura de 2 letras) |
| `std_sx_n` | Sexo |
| `std_bd_n` | Día de nacimiento (2 dígitos) |
| `std_bm_n` | Mes de nacimiento (2 dígitos) |
| `std_by_n` | Año de nacimiento (2 dígitos) |
| `std_part_n` | Nombre de la materia de grupo/participación asignada a este estudiante |

### Totales

| Nombre | Descripción |
|---|---|
| `std_total` | Cantidad total de estudiantes en la sección |
| `std_page_count` | Cantidad de estudiantes en esta página |

### Calificaciones (`grade_X_Y`)

`X` = número de columna (1 = primera materia, 2 = segunda…).  
`Y` = número de fila del estudiante (1-35).

La plantilla tiene `grade_X_Y` para X=1..9 e Y=1..35 (315 celdas por hoja base).

**Regla de llenado:**

1. Si la materia tiene `usesLiteralGrades = true` (columna en la tabla `subjects`):
   - Si el estudiante **tiene nota definitiva** (de `SubjectFinalGrade.finalScore` o calculada de qualifications + council points): se escribe la **letra** correspondiente según la escala `letter_grades` configurada en los ajustes del sistema (conversión vía `numericToLetter`).
   - Si el estudiante **no tiene nota** (sin qualifications ni finalGrade): se escribe la **letra más baja de la escala configurada** (ej. si la escala es A=20, B=16, C=12 → se escribe "C").
2. Si la materia **no** usa notas literales (`usesLiteralGrades = false`):
   - Si el estudiante **tiene nota definitiva**: se escribe el **número** (formateado con `padNumber`, ej. 15.0 → "15", 2.5 → "02.5", etc.).
   - Si el estudiante **no tiene nota**: la celda se deja vacía (no se sobreescribe el placeholder de la plantilla).

**Nota**: Para materias recién agregadas al grado que aún no tienen registros `InscriptionSubject` para los estudiantes, el sistema detecta `usesLiteralGrades` desde la tabla `subjects` vía `academicSubjects` (poblado desde `PeriodGradeSubject` + asociación `Subject`).

---

## Materias de grupo (`std_part_n`)

Las materias de grupo se identifican porque `Subject.subjectGroupId IS NOT NULL`.

Cada estudiante tiene UNA materia de grupo en su inscripción (la primera encontrada con `groupedSubjectIds.has(is.subjectId)`). Su nombre completo se escribe en `std_part_n`.

A diferencia de las materias académicas, las materias de grupo NO muestran calificaciones en el resumen — solo el nombre.

---

## Plantilla y named ranges

La plantilla reside en `backend/templates/`. El usuario puede:
1. Subir plantillas personalizadas vía la UI del sistema.
2. Asignar una plantilla a un grado (o grado+sección) desde los ajustes.
3. Sobrescribir la plantilla vía query param `?template=` en la URL.

**Named ranges**: todos los named ranges deben estar predefinidos en el archivo `.xlsx`. El sistema solo llena los que existen. Si un named range falta, la celda correspondiente simplemente no se toca.

Para que el auto-append de columnas funcione (más de 9 materias), el nombre del archivo debe empezar con "resumenFinal" (case-insensitive).

---

## Orden de materias

Las materias se ordenan según `PeriodGradeSubject.order`, definido en la estructura académica del grado. El orden canónico se obtiene vía `getSubjectOrderMap(pg.id)` y se aplica tanto para la cabecera como para las calificaciones.

---

## Scoring

La `calculateFinalScore` para cada `InscriptionSubject`:
1. Si existe `SubjectFinalGrade.finalScore`, usa ese valor directamente.
2. Si no, calcula el promedio ponderado de todos los `Qualification.score` (por porcentaje del plan de evaluación) por lapso, dividido entre el número de lapsos, y suma los puntos de consejo (`CouncilPoint.points`).
