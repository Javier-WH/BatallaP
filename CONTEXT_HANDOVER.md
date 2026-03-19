# Resumen de Cambios - 25 de Enero de 2026

## Objetivo Principal
Habilitar el cambio de Representante desde la tabla de Matrícula (`MatriculationEnrollment`) y mejorar el flujo de asignación de representantes, permitiendo registrar nuevos representantes directamente desde la ventana de búsqueda si no existen.

## Cambios Realizados

### 1. Nuevo Componente Reutilizable (`SearchGuardianModal`)
- **Ubicación:** `frontend/src/components/shared/SearchGuardianModal.tsx`
- **Funcionalidad:**
  - Permite buscar representantes por Tipo de Documento y Número.
  - Si el representante **existe**, muestra sus datos (Nombre, Teléfono) y permite seleccionarlo.
  - Si el representante **no existe**, muestra un mensaje de alerta e **incrusta automáticamente el formulario de registro** dentro del mismo modal.
  - El botón "Registrar y Seleccionar" crea el registro en BD y devuelve los datos inmediatamente al componente padre.

### 2. Actualización de Matrícula (`MatriculationEnrollment.tsx`)
- Se agregó una opción **"Cambiar Representante"** al menú contextual (clic derecho en la fila).
- Se integró el modal `SearchGuardianModal`.
- **Lógica de Actualización:**
  - Al seleccionar un nuevo representante, el sistema verifica si coincide con la Madre o el Padre ya registrados para asignar el `representativeType` correcto ('mother' o 'father').
  - Si no coincide, se asigna como 'other' (Otro).
  - La fila se marca como editada (fondo amarillo) lista para guardar cambios.

### 3. Refactorización de Edición de Usuario (`EditUser.tsx`)
- Se eliminó el código duplicado del modal de búsqueda que existía en este archivo.
- Se reemplazó por el componente compartido `SearchGuardianModal`, asegurando consistencia en toda la aplicación.

### 4. Backend & Servicios
- **Controlador (`guardianController.ts`):**
  - Se creó la función `createGuardian` para manejar solicitudes POST de creación.
  - Se limpió y optimizó la función `searchGuardian`.
- **Rutas (`guardianRoutes.ts`):**
  - Se registró el endpoint `POST /` para la creación de representantes.
- **Servicio Frontend (`guardians.ts`):**
  - Se añadió la función `createGuardian` para consumir el nuevo endpoint.

## Archivos Modificados
- `backend/src/controllers/guardianController.ts`
- `backend/src/routes/guardianRoutes.ts`
- `frontend/src/services/guardians.ts`
- `frontend/src/components/shared/SearchGuardianModal.tsx` (Nuevo)
- `frontend/src/pages/control-estudios/MatriculationEnrollment.tsx`
- `frontend/src/pages/shared/EditUser.tsx`

## Estado Actual
El sistema permite cambiar el representante de un estudiante de manera fluida. Si al buscar una cédula no se encuentra resultado, el usuario puede registrar los datos básicos (Nombre, Apellido, Teléfono, Dirección) en ese mismo instante sin perder el contexto de la edición.
