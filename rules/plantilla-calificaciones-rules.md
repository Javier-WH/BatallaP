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
