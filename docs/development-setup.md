# 🛠️ Configuración y ejecución del proyecto

## Requisitos previos

- **Node.js** 18+ (recomendado 20+)
- **MySQL** 5.7+ o 8.x
- **npm** 9+
- **Windows / Linux / macOS** (el proyecto se desarrolla principalmente en Windows con PowerShell)

## Estructura del monorepo

```
BatallaProject/
├── backend/          # API Express + Sequelize + MySQL
├── frontend/         # SPA React + Vite + Ant Design
├── tests/            # Tests de integración (Jest + supertest) a nivel monorepo
├── docs/             # Documentación canónica
├── notes/            # Bitácoras de sesiones (no canónico)
├── package.json      # Scripts globales (usa concurrently)
└── AGENTS.md         # Índice maestro para IA
```

## Variables de entorno

### Backend (`backend/.env`)
```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
SESSION_SECRET=change-me

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=bp
```

Archivo de referencia de tests: `backend/.env.test`.

### Frontend
Vite lee `VITE_API_URL` si está definida (ver `frontend/src/services/api.ts`). Por defecto apunta a `http://localhost:3000/api`.

## Instalación inicial

```powershell
# En la raíz
npm install

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Tests (opcional)
cd ../tests
npm install
```

## Base de datos

### Crear y poblar la base

```powershell
cd backend

# Sincroniza schema (DROP + CREATE) y ejecuta seeds básicos
npm run db:sync

# Reset completo con datos académicos masivos (usuarios, períodos, matrículas, no inscritos)
npm run seed:full-reset

# Seeds individuales
npm run seed
npm run seed:academic-structure
npm run seed:subject-groups
npm run seed:bulk-inscriptions
npm run seed:unregistered
```

`db:sync` elimina y recrea todas las tablas (`sequelize.sync({ force: true })`). **No usar en producción.**

### Migraciones

Hay migraciones manuales en `backend/migrations/` y `backend/src/migrations/` usadas para parches puntuales. La fuente de verdad del schema es `sequelize.sync()` más los modelos en `backend/src/models/`.

## Comandos de desarrollo

### Raíz (monorepo)
```powershell
npm run dev        # Levanta backend y frontend en paralelo (concurrently)
npm run build      # Build completo
npm run start      # Ejecuta backend (dist) + frontend (preview)
```

### Backend (`/backend`)
```powershell
npm run dev             # nodemon + ts-node
npm run build           # Compila a /dist
npm start               # Corre el build compilado
npm test                # Jest
npm run test:watch
npm run test:coverage
```

Puerto: `http://localhost:3000`.

### Frontend (`/frontend`)
```powershell
npm run dev     # Vite dev server
npm run build
npm run lint
npm run preview
```

Puerto: `http://localhost:5173`.

### Tests de integración (`/tests`)
```powershell
cd tests
npm test
```

Ver [`tests/README.md`](../tests/README.md) para detalles de los flows (`tests/flows/`) y módulos (`tests/modules/`).

## Path aliases

### Backend (`backend/tsconfig.json`)
Usa `@/*` → `src/*` y alias específicos (`@controllers/*`, `@models/*`, `@routes/*`, `@middlewares/*`, `@config/*`). Se resuelven en tiempo de ejecución con `tsconfig-paths/register` (ver `npm run dev`).

### Frontend (`frontend/vite.config.ts`)
Usa `vite-tsconfig-paths` y alias `@/*` → `src/*`.

## Sesiones y CORS

- Sesiones persistidas en MySQL con `connect-session-sequelize` (tabla `sessions`, expiración 1 día).
- CORS permite `CORS_ORIGIN` (default `http://localhost:5173`) con `credentials: true`.
- El frontend debe enviar requests con `withCredentials: true` (configurado en `frontend/src/services/api.ts`).

## Archivos estáticos / uploads

- `backend/public/uploads/` → imágenes de logos, documentos de matrícula, imágenes del dashboard.
- El backend sirve archivos a través de endpoints específicos (ver `uploadRoutes.ts` y `dashboardContentRoutes.ts`).

## Debugging rápido

| Problema | Revisar |
|----------|---------|
| `Cannot connect to DB` | `backend/.env`, servicio MySQL corriendo |
| `CORS error` | `CORS_ORIGIN` y `withCredentials` en axios |
| Sesión no persiste | Tabla `sessions`, cookies httpOnly, puerto/domain coincide |
| Rol no reconocido | Ver `docs/roles-permissions.md` (nombres canónicos en español) |
| `sync({ force: true })` borra datos | Usar seeds para regenerar |

Más detalle: [`docs/conventions.md`](./conventions.md) y [`docs/roles-permissions.md`](./roles-permissions.md).
