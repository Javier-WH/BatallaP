# 📋 Reglas — Plantilla de Calificaciones Oficial

> **Propósito**: Documentar todas las reglas del formato Excel oficial de calificaciones generado por `exportGradesExcelOficial` en `backend/src/controllers/evaluationController.ts`.
> Este archivo es de actualización incremental: el usuario puede agregar o eliminar reglas según convenga.

---

## Reglas

### R1: Columnas por evaluación

Cada evaluación se compone de **3 columnas**:

| Columna | Significado | Descripción |
|---------|-------------|-------------|
| **NOT** | Nota | Calificación del estudiante en la evaluación |
| **REM** | Remedial | Nota de recuperación si aplica |
| **%** | Porcentaje | Porcentaje ponderado de la evaluación (nota efectiva × porcentaje del plan / 100) |

### R2: Bloque derecho del encabezado

Las celdas combinadas del lado derecho (filas 1-4) —"Educación Media General", código DEA, y momento/lapso— deben abarcar **únicamente las columnas de evaluaciones**, no las columnas DEF ni Observaciones. El rango se adapta dinámicamente según la cantidad de evaluaciones.

### R3: Bordes externos de cada evaluación

Cada bloque de evaluación (3 columnas: NOT, REM, %) debe tener **bordes externos más gruesos** (estilo `medium`) en sus lados izquierdo y derecho, tanto en el encabezado (filas 5-8) como en las filas de datos y resumen. Los bordes internos entre NOT, REM y % permanecen finos (`thin`). El borde superior de la fila 5 y el inferior de la fila 7 también son gruesos para cerrar el bloque del encabezado.

### R4: Formato de notas

Las notas deben mostrarse como **números enteros** con **mínimo 2 dígitos**, usando el formato `00`. Es decir:
- Si la nota es 5 → se muestra `05`
- Si la nota es 3 → se muestra `03`
- Si la nota es 10 → se muestra `10`

Aplica a las columnas NOT, REM, % y DEF.

### R5: Filas con efecto zebra

Las filas de datos de los estudiantes deben tener colores intercalados:
- **Filas impares** (2da, 4ta, 6ta...): fondo azul ligero `#F2F5FA`
- **Filas pares** (1ra, 3ra, 5ta...): fondo blanco

La columna DEF mantiene su propio fondo verde (`#E2EFDA`) independientemente del efecto zebra.
