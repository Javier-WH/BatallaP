---
description: mantener consistencia de roles y accesos
---

1. Revisar nombres de roles en backend (`Role` model y seeds) para confirmar que los valores canónicos son `Master`, `Administrador`, `Control de Estudios`, `Profesor`, `Representante`, `Alumno`.
2. En formularios de registro (p.ej. `RegisterStaff.tsx`), asegurarse de que los checkboxes y payloads usen exactamente esos nombres antes de enviarlos al backend.
3. Verificar las rutas protegidas (`App.tsx`) y componentes de layout (`MainLayout.tsx`, toolbars específicos) para que las listas `allowedRoles` o `roles` sólo incluyan los nombres canónicos.
4. Centralizar accesos comunes en la barra lateral global: 
   - `Buscar / Editar` → roles `Master`, `Administrador`.
   - `Estudiantes` → roles `Master`, `Administrador`, `Control de Estudios`.
5. Remover accesos duplicados en toolbars secundarios (por ejemplo, eliminar el botón "Estudiantes" de `AdminLayout.tsx`), para que los usuarios naveguen por el menú principal.
6. Cuando se cambie la visibilidad de un módulo, actualizar tanto el menú como la ruta protegida correspondiente para mantener sincronizados UI y permisos.
7. Documentar futuros cambios en este archivo para que otros agentes recuerden el flujo de permisos.
