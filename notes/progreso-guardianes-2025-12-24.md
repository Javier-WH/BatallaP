# Progreso (24 de diciembre de 2025)

## ✅ Completado hoy
1. **Backend**
   - Se creó el modelo `GuardianProfile` con restricción única por (`documentType`, `document`).
   - Migraciones para crear la tabla, migrar datos existentes desde `student_guardians` y limpiar columnas duplicadas.
   - Servicio `guardianProfileService` con `findGuardianProfile` y `findOrCreateGuardianProfile`.
   - Servicio auxiliar `assignGuardians` y actualización de los controladores de inscripción (`registerAndEnroll` y `enrollMatriculatedStudent`) para reutilizar representantes.
   - Nuevo endpoint `/api/guardians/search` y ruta registrada en `server.ts`.

2. **Frontend groundwork**
   - Se añadió el servicio `searchGuardian` para consultar `/api/guardians/search`.
   - Se esbozó la estructura de constantes (opciones de documento, labels) que se usará en los formularios, aunque no se mantiene en el commit final porque se revertió para dejar la UI estable.

## 🔁 Pendiente para mañana
1. **Formulario Admin (`EnrollStudent.tsx`)**
   - Insertar selector de tipo de documento y el input de cédula al inicio de cada bloque (madre/padre/representante), usando `guardianDocumentOptions`.
   - Al detectar tipo+cédula, invocar `searchGuardian` y autocompletar los campos cuando exista el representante (con indicador de carga).
   - Mantener la UI estable y sin duplicaciones de imports.

2. **Formulario Control de Estudios (`MatriculationEnrollment.tsx`)**
   - Replicar la misma lógica de selector + búsqueda para los tutores durante la inscripción desde Control de Estudios.

3. **Pruebas y documentación**
   - Verificar el flujo end-to-end (crear estudiante nuevo, reutilizar representantes existentes y matricular estudiantes ya registrados).
   - Actualizar documentación/README con la descripción del catálogo de representantes y los pasos para el autocompletado.

## Notas
- Actualmente los controladores backend **ya esperan** `documentType` en los objetos de tutores, por lo que el frontend debe enviar ese dato.
- Los cambios en frontend se revertieron para evitar dejar JSX inconsistente; retomar desde el estado actual (commit limpio) antes de agregar el selector.
