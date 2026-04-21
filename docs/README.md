# 📚 Documentación BatallaProject

> Documentación técnica centralizada para desarrolladores y agentes de IA.
> El punto de entrada principal es `AGENTS.md` en la raíz del repositorio.

## 🗂️ Índice de documentación

### Fundamentos
- [`development-setup.md`](./development-setup.md) – Cómo instalar, configurar y correr el proyecto (backend, frontend, base de datos, seeds, tests).
- [`conventions.md`](./conventions.md) – Convenciones de código, naming, idioma, estructura de archivos y patrones.
- [`roles-permissions.md`](./roles-permissions.md) – Matriz completa de roles, rutas protegidas y permisos por módulo.

### Arquitectura
- [`backend-api.md`](./backend-api.md) – Referencia completa de todos los endpoints REST (`/api/*`).
- [`backend-modules.md`](./backend-modules.md) – Propósito de cada controller, service y middleware del backend.
- [`frontend-modules.md`](./frontend-modules.md) – Páginas por rol, componentes compartidos, services HTTP y contextos globales.
- [`database-models.md`](./database-models.md) – Modelos Sequelize, asociaciones y diagrama entidad-relación.

### Flujos de negocio
- [`flows/authentication.md`](./flows/authentication.md) – Login, sesiones y control de acceso.
- [`flows/enrollment.md`](./flows/enrollment.md) – Matriculación + inscripción + carga masiva por Excel.
- [`flows/grading.md`](./flows/grading.md) – Planes de evaluación, calificaciones, consejos de curso y notas finales.
- [`flows/period-closure.md`](./flows/period-closure.md) – Cierre de período, promoción de estudiantes y materias pendientes.
- [`flows/grade-edit.md`](./flows/grade-edit.md) – Sistema de permisos para editar notas de períodos anteriores y auditoría.

### Notas históricas (no canónicas)
Los archivos en [`../notes/`](../notes/) contienen decisiones de diseño y contexto de sesiones anteriores:
- [`notes/arquitectura-cierre-periodos.md`](../notes/arquitectura-cierre-periodos.md)
- [`notes/sistema-edicion-notas.md`](../notes/sistema-edicion-notas.md)
- [`notes/progreso-guardianes-2025-12-24.md`](../notes/progreso-guardianes-2025-12-24.md)

### Handover y análisis
- [`../CONTEXT_HANDOVER.md`](../CONTEXT_HANDOVER.md) – Contexto de handover entre sesiones.
- [`../ANALISIS_FUNCIONALIDAD.md`](../ANALISIS_FUNCIONALIDAD.md) – Análisis funcional del sistema.
- [`../CHANGELOG_SESSION_2026_01_24.md`](../CHANGELOG_SESSION_2026_01_24.md) – Historial de cambios.

## 📖 Convención de lectura para agentes de IA

1. **Siempre leer primero** `AGENTS.md` en la raíz (índice maestro).
2. **Para tareas específicas**, ir al documento temático relevante en `/docs`.
3. **Para modificar código**, revisar el `AGENTS.md` de la carpeta correspondiente (ej. `backend/src/controllers/AGENTS.md`).
4. **Para flujos complejos** (inscripción, cierre de período, notas), leer el archivo en `docs/flows/` antes de tocar código.

## 🔄 Mantenimiento

Al introducir cambios relevantes:
- Actualizar el documento temático correspondiente en `/docs`.
- Si se añade un módulo nuevo, registrar su carpeta en el `AGENTS.md` raíz.
- Usar las notas en `/notes` solo para bitácoras temporales; la documentación canónica vive en `/docs`.
