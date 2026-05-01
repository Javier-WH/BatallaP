# AGENTS.md — Índice maestro de BatallaProject

> **Punto de entrada para modelos de IA y desarrolladores.**
> Este archivo funciona como índice. La documentación canónica vive en [`docs/`](./docs/).
>
> ⚠️ **Agentes de IA**: Antes de modificar código, leer **obligatoriamente**:
> 1. [`rules/RULES.md`](./rules/RULES.md) — Reglas de Oro (qué NUNCA cambiar)
> 2. [`rules/BUSINESS_MODEL.md`](./rules/BUSINESS_MODEL.md) — Modelo de negocio
> 3. [`rules/tasks/active_task.json`](./rules/tasks/active_task.json) — Tarea activa

---

## 📋 ¿Qué es este proyecto?

**BatallaProject** es un **Sistema de Gestión Escolar** (School Management System) monorepo con:

- **Backend**: API REST en Node.js + Express 5 + TypeScript + Sequelize 6 + MySQL.
- **Frontend**: SPA React 19 + TypeScript + Vite 7 + Ant Design 6 + React Router 7.

Administra períodos académicos, matriculación e inscripción de estudiantes, gestión de usuarios con 6 roles, planes de evaluación, calificaciones, consejos de curso, cierre de período con promoción automática, y edición auditada de notas de períodos cerrados.

---

## 🚀 Quick start

```powershell
# Raíz
npm install
npm run dev          # Levanta backend (3000) + frontend (5173)

# Reset DB + seeds demo
cd backend
npm run db:sync
```

Detalles, variables de entorno y comandos completos: [`docs/development-setup.md`](./docs/development-setup.md).

---

## 🗺️ Mapa del repositorio

```
BatallaProject/
├── AGENTS.md                       ← Estás aquí (índice maestro)
├── rules/                          ← 🏗️ Harness Engineering (arnés para agentes IA)
│   ├── README.md                   ← Qué es el arnés y cómo usarlo
│   ├── RULES.md                    ← ⚖️ Reglas de Oro (obligatorio para agentes)
│   ├── BUSINESS_MODEL.md           ← 🏫 Modelo de negocio escolar completo
│   ├── STATUS.md                   ← 📊 Estado funcional del proyecto
│   ├── verify.ps1                  ← 🔍 Script de verificación (Gates 0-3)
│   ├── progress/                   ← 📝 Memoria externa (estado de tareas)
│   ├── tasks/                      ← 📋 Backlog y tarea activa (JSON)
│   ├── checklists/                 ← ✅ Checklists reutilizables
│   └── orchestration/              ← 🎯 Protocolo líder + delegación
├── docs/                           ← 📚 Documentación canónica
│   ├── README.md                   ← Índice de /docs
│   ├── development-setup.md        ← Instalación y ejecución
│   ├── conventions.md              ← Convenciones de código
│   ├── roles-permissions.md        ← Matriz de roles y rutas
│   ├── backend-api.md              ← Referencia REST completa
│   ├── backend-modules.md          ← Mapa de controllers/services/middlewares
│   ├── frontend-modules.md         ← Mapa de páginas/services/components
│   ├── database-models.md          ← Modelos y asociaciones Sequelize
│   └── flows/                      ← Flujos de negocio
│       ├── authentication.md
│       ├── enrollment.md           ← Matriculación + inscripción + bulk Excel
│       ├── grading.md              ← Plan de evaluación + notas
│       ├── period-closure.md       ← Cierre de período + promoción
│       └── grade-edit.md           ← Permisos de edición + auditoría
├── backend/
│   ├── src/
│   │   ├── app.ts                  ← Express + middlewares + rutas
│   │   ├── server.ts               ← Entry point
│   │   ├── seed.ts                 ← Seed básico de usuarios
│   │   ├── config/                 ← database.ts
│   │   ├── controllers/            ← ★ AGENTS.md (lógica HTTP)
│   │   ├── services/               ← ★ AGENTS.md (lógica de negocio)
│   │   ├── routes/                 ← ★ AGENTS.md (Express routers)
│   │   ├── models/                 ← ★ AGENTS.md (Sequelize + index.ts)
│   │   ├── middlewares/            ← Multer (uploads)
│   │   ├── seeders/                ← Seeds avanzados (academic, bulk matriculations)
│   │   ├── migrations/             ← Migraciones manuales puntuales
│   │   ├── assets/venezuela.json   ← Catálogo estados/municipios/parroquias
│   │   └── __tests__/              ← Jest + supertest
│   ├── public/uploads/             ← Logos, documentos, imágenes de dashboard
│   ├── package.json
│   └── README_TESTS.md
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx                 ← Router + RequireAuth
│   │   ├── context/                ← AuthContext + SchoolContext
│   │   ├── pages/                  ← ★ AGENTS.md (páginas por rol)
│   │   │   ├── shared/             ← EditUser, SearchUsers, DashboardEditor
│   │   │   ├── master/             ← AcademicManagement, Dashboard, Settings
│   │   │   ├── admin/              ← EnrollStudent, GradeEditPermissions, …
│   │   │   ├── control-estudios/   ← MatriculationEnrollment, CourseCouncil, FinalGradesEdit
│   │   │   ├── teacher/            ← TeacherPanel
│   │   │   ├── representative/     ← MyStudents
│   │   │   └── student/            ← MyDossier, StudentDetail
│   │   ├── services/               ← ★ AGENTS.md (axios clients)
│   │   └── components/             ← ★ AGENTS.md (reutilizables)
│   └── package.json
├── tests/                          ← Tests de integración monorepo (ver tests/README.md)
├── notes/                          ← Bitácoras de sesiones (archivo histórico)
│   ├── arquitectura-cierre-periodos.md
│   ├── sistema-edicion-notas.md
│   └── progreso-guardianes-2025-12-24.md
├── .windsurf/workflows/            ← Workflows slash-command
│   └── roles-and-access.md
└── package.json                    ← Scripts raíz (concurrently)
```

**Archivos marcados con ★** tienen su propio `AGENTS.md` con detalle específico.

---

## 🔗 Enlaces rápidos por tarea

### Soy un agente de IA y voy a empezar a trabajar
1. [`rules/RULES.md`](./rules/RULES.md) — Reglas de Oro (OBLIGATORIO)
2. [`rules/BUSINESS_MODEL.md`](./rules/BUSINESS_MODEL.md) — Entender el negocio
3. [`rules/tasks/active_task.json`](./rules/tasks/active_task.json) — Tarea activa
4. [`rules/checklists/pre-delivery.md`](./rules/checklists/pre-delivery.md) — Checklist antes de entregar

### Voy a modificar un endpoint
1. [`docs/backend-api.md`](./docs/backend-api.md) – encontrar el endpoint.
2. [`backend/src/controllers/AGENTS.md`](./backend/src/controllers/AGENTS.md) – convenciones.
3. [`backend/src/models/AGENTS.md`](./backend/src/models/AGENTS.md) – aliases de asociaciones si hay includes.

### Voy a modificar una página del frontend
1. [`docs/frontend-modules.md`](./docs/frontend-modules.md) – localizar la página.
2. [`frontend/src/pages/AGENTS.md`](./frontend/src/pages/AGENTS.md) – convenciones.
3. [`docs/roles-permissions.md`](./docs/roles-permissions.md) – verificar permisos.

### Voy a trabajar en un flujo de negocio
| Flujo | Documento |
|-------|-----------|
| Login / sesiones | [`docs/flows/authentication.md`](./docs/flows/authentication.md) |
| Matricular/inscribir/bulk Excel | [`docs/flows/enrollment.md`](./docs/flows/enrollment.md) |
| Notas, planes, consejo de curso | [`docs/flows/grading.md`](./docs/flows/grading.md) |
| Cierre de período + promoción | [`docs/flows/period-closure.md`](./docs/flows/period-closure.md) |
| Editar notas con permiso + auditoría | [`docs/flows/grade-edit.md`](./docs/flows/grade-edit.md) |

### Voy a añadir un rol o modificar accesos
1. [`docs/roles-permissions.md`](./docs/roles-permissions.md)
2. [`.windsurf/workflows/roles-and-access.md`](./.windsurf/workflows/roles-and-access.md) (checklist)

### Voy a trabajar en la base de datos
1. [`docs/database-models.md`](./docs/database-models.md)
2. [`backend/src/models/AGENTS.md`](./backend/src/models/AGENTS.md)
3. Asociaciones centralizadas en [`backend/src/models/index.ts`](./backend/src/models/index.ts).

---

## 🔐 Roles del sistema

Nombres **canónicos** (en español, case-sensitive):

`Master` · `Administrador` · `Control de Estudios` · `Profesor` · `Representante` · `Alumno`

⚠️ **Nunca** usar `Admin`, `Teacher`, `Student` – rompe la protección de rutas. Ver [`docs/roles-permissions.md`](./docs/roles-permissions.md).

---

## 🔧 Stack

### Backend
Node.js · Express 5 · TypeScript 5.9 · Sequelize 6 · MySQL 8 · bcrypt · express-session · connect-session-sequelize · ExcelJS · Puppeteer · multer · Jest + supertest

### Frontend
React 19 · TypeScript 5.9 · Vite 7 · Ant Design 6 · React Router 7 · Axios · Sass · dayjs

---

## 📌 Funcionalidades principales

### ✅ Implementadas
1. Autenticación con sesiones persistidas en MySQL.
2. CRUD completo de usuarios con 6 roles.
3. Gestión académica: períodos, grados, secciones, materias, specializations, subject groups.
4. Matriculación estándar + rápida + masiva (Excel).
5. Inscripciones con representantes reutilizables (`GuardianProfile`).
6. Asignación de profesores por materia+sección.
7. Planes de evaluación y calificaciones por profesor.
8. Consejos de curso con checklist.
9. Cierre de período con promoción automática y `PendingSubject`.
10. Sistema de permisos para editar notas finales de períodos cerrados, con auditoría completa.
11. Reportes PDF de matrícula (Puppeteer).
12. Dashboard editable con contenido administrable.

### 🚧 Pendientes / Mejoras identificadas
- Middleware global `requireAuth` / `requireRole` (hoy cada controller valida individualmente).
- Dashboard de estudiantes más rico.
- Dashboard de profesores con métricas.
- Reportes académicos extendidos.

---

## 📝 Historial relevante

- Sistema de representantes reutilizables vía `GuardianProfile` (evita duplicados).
- Normalización de roles al español canónico.
- Consolidación de `SearchUsers` y `EditUser` en `/pages/shared` con permisos según rol.
- Sistema de permisos + auditoría para edición de notas (Master/Admin otorgan, Control de Estudios ejecuta).
- Carga masiva por Excel con named ranges y validación por fila.
- Separación clara entre `Matriculation` (solicitud) e `Inscription` (inscripción formal).

Bitácoras específicas en [`notes/`](./notes/).

---

## 💡 Convenciones resumidas

- **Idioma del código y comentarios**: inglés. **Idioma de la UI**: español.
- **TypeScript**: modo estricto; evitar `any`.
- **Transacciones**: `sequelize.transaction()` para operaciones multi-tabla.
- **Asociaciones Sequelize**: SOLO en `backend/src/models/index.ts`.
- **Protección de rutas (frontend)**: `<RequireAuth allowedRoles={[...]}>` en `App.tsx` con nombres de rol en español.
- **Axios**: `withCredentials: true` (configurado en `frontend/src/services/api.ts`).
- **Orden de materias**: Usar `PeriodGradeSubject.order` via `subjectOrderService`. Ver [`docs/conventions.md#orden-canonico-de-materias`](./docs/conventions.md#orden-canonico-de-materias).

Detalle en [`docs/conventions.md`](./docs/conventions.md).

---

## 🔄 Mantenimiento de la documentación

Cuando introduzcas cambios relevantes:
1. Actualiza el documento temático en `docs/` correspondiente.
2. Si añades una carpeta/módulo nuevo, regístrala en este AGENTS.md.
3. Si tocas un flujo de negocio, revisa el `docs/flows/*.md` relacionado.
4. Para cambios en permisos/rutas, pasa por [`.windsurf/workflows/roles-and-access.md`](./.windsurf/workflows/roles-and-access.md).

---

*Documentación reorganizada en Abril 2026. Estructura híbrida: AGENTS.md centrales + `/docs` temático + AGENTS.md por carpeta compleja.*
