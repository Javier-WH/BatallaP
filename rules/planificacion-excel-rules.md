# Reglas — Excel de Planificación

> **Alcance exclusivo**: estas reglas aplican únicamente al archivo generado por `exportPlanningExcel` en `backend/src/controllers/evaluationController.ts`, mediante `GET /api/evaluation/export-planning/:assignmentId`.
>
> No aplican a las plantillas, actas ni a ningún otro Excel generado por el sistema.

## Reglas visuales

### R1: Perímetro externo de la tabla

La tabla de planificación debe tener un borde externo continuo y grueso (`medium`) en todo su perímetro:

- Borde superior: desde la columna A hasta la última columna de la tabla.
- Borde inferior: desde la columna A hasta la última columna de la tabla y la última fila de datos.
- Borde izquierdo: desde la fila de encabezados hasta la última fila de datos en la columna A.
- Borde derecho: desde la fila de encabezados hasta la última fila de datos en la última columna.

El perímetro debe aplicarse después de todos los merges y separadores internos para que ningún estilo posterior lo elimine.

### R2: Celdas fusionadas

Las celdas fusionadas verticalmente deben conservar el borde visible en su última fila. Cuando ExcelJS no propague el estilo desde la celda master, el borde debe aplicarse también a la celda terminal visible del merge.

Esto es especialmente importante para la columna J, que contiene el total de puntos por criterio y puede estar fusionada verticalmente cuando el criterio tiene varios indicadores.

### R3: Encabezado de puntos

Las columnas I y J comparten el encabezado `PUNTOS` mediante el merge `I7:J8`. El texto debe permanecer centrado horizontal y verticalmente.

### R4: Tipo de evaluación

El encabezado `TIPO DE EVALUACIÓN` ocupa `K7:M7`, y sus subencabezados `INTRA`, `INTER` y `TRANS` ocupan `K8:M8`.

### R5: Bordes internos

Los separadores internos pueden utilizar bordes finos o medios según el bloque que delimiten, pero nunca deben eliminar ni sustituir el borde externo grueso definido en R1.
