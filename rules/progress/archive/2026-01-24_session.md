# Registro de Cambios - Sesión 24 Enero 2026
## Resumen de Progreso
Se han realizado correcciones críticas en el flujo de Cierre de Periodo, la lógica de promoción de estudiantes, la integridad referencial de la base de datos y la visualización del panel de profesores.

## Cambios Detallados

### 1. Cierre de Periodo (Frontend & Backend)
*   **Detección de Periodo Siguiente:** Se actualizó `PeriodClosurePanel.tsx` para detectar si falta el "Próximo Periodo" al intentar validar el cierre.
*   **Modal de Creación:** Se implementó un modal automático que permite crear el nuevo periodo escolar (ej. "2026-2027") directamente desde la interfaz de cierre si no existe.
*   **API Service:** Se creó `frontend/src/services/academic.ts` para exponer la función `createPeriod` necesaria para este modal.
*   **Etiquetas de Estado:** Se actualizó la etiqueta visual para estudiantes con materias reprobadas (1-3) de "Materias pendientes" a **"Materia Pendiente"** (singular) con color naranja, para diferenciar claramente del estado "Aprobado".

### 2. Lógica de Promoción (`StudentPromotionEngine.ts`)
*   Se ajustó la lógica para determinar el estado final del estudiante:
    *   **Aprobado:** 0 materias reprobadas.
    *   **Materia Pendiente:** 1 a 3 materias reprobadas (configurable).
    *   **Reprobado:** Más de 3 materias reprobadas.

### 3. Base de Datos - Eliminación en Cascada
Se solucionaron los errores de "Foreign Key Constraint Constraint" al intentar eliminar un estudiante (Person).
*   **Migración Inscriptions:** `20260124144851-update-inscription-person-constraint.js` cambia la FK de `inscriptions.personId` a `ON DELETE CASCADE`.
*   **Migración Matriculations:** `20260124145644-update-matriculation-person-constraint.js` cambia la FK de `matriculations.personId` a `ON DELETE CASCADE`.
*   **Configuración:** Se creó `backend/config/config.js` para permitir la ejecución de migraciones con Sequelize CLI en el entorno TypeScript/Dotenv.

### 4. Panel de Profesor (`evaluationController.ts`)
*   **Visibilidad de Alumnos:** Se corrigió el bug donde los alumnos no aparecían en la lista del profesor o aparecían alumnos incorrectos.
*   **Filtro Ajustado:** La función `getStudentsForAssignment` ahora filtra por:
    *   `schoolPeriodId` y `sectionId` correctos.
    *   Y además: (`gradeId` coincide con el del profesor **O** `escolaridad` es 'materia_pendiente').
    *   Esto permite que un alumno de 2do año viendo Inglés de 1ro (como pendiente) aparezca en la lista del profesor de 1ro, sin mezclar alumnos regulares de otros grados.

## Próximos Pasos (Pendientes)
*   Verificar flujo completo de cierre de periodo con casos de borde (ej. alumno repitiente puro).
*   Validar que la inscripción automática al nuevo periodo ("Arrastre") esté funcionando correctamente tras el cierre.
*   Revisar si existen otras tablas que requieran eliminación en cascada (ej. `Guardian`, `StudentPreviousSchool`).
