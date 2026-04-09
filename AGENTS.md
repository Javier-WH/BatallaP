# AGENTS.md - Contexto del Proyecto

> Este archivo proporciona contexto a modelos de IA y agentes que trabajan con este repositorio.

## 📋 Descripción General

**BatallaProject** es un **Sistema de Gestión Escolar** (School Management System) diseñado para administrar períodos académicos, inscripciones de estudiantes, gestión de usuarios y estructuras educativas.

---

## 🏗️ Arquitectura del Proyecto

El proyecto sigue una arquitectura **monorepo** con separación clara entre frontend y backend:

```
BatallaProject/
├── backend/          # API RESTful con Node.js + Express + TypeScript
├── frontend/         # SPA con React + TypeScript + Vite
└── AGENTS.md         # Este archivo
```

---

## 🔧 Stack Tecnológico

### Backend (`/backend`)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | - | Runtime |
| Express | 5.x | Framework web |
| TypeScript | 5.9.x | Lenguaje |
| Sequelize | 6.x | ORM |
| MySQL | - | Base de datos |
| bcrypt | 6.x | Hashing de contraseñas |
| express-session | 1.x | Manejo de sesiones |

### Frontend (`/frontend`)
| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | 19.x | UI Library |
| TypeScript | 5.9.x | Lenguaje |
| Vite | 7.x | Bundler/Dev Server |
| Ant Design | 6.x | Componentes UI |
| React Router | 7.x | Enrutamiento |
| Axios | 1.x | Cliente HTTP |
| Sass | 1.x | Preprocesador CSS |

---

## 📁 Estructura del Backend

```
backend/src/
├── app.ts              # Configuración de Express
├── server.ts           # Punto de entrada del servidor
├── seed.ts             # Datos iniciales para la BD
├── config/             # Configuración (DB, etc.)
├── controllers/        # Lógica de negocio
│   ├── academicController.ts    # Gestión académica
│   ├── authController.ts        # Autenticación
│   ├── inscriptionController.ts # Inscripciones
│   └── userController.ts        # Usuarios
├── models/             # Modelos Sequelize
├── routes/             # Definición de rutas API
├── middlewares/        # Middlewares personalizados
└── types/              # Tipos TypeScript
```

### Modelos de Datos

El sistema utiliza los siguientes modelos principales:

| Modelo | Descripción |
|--------|-------------|
| `User` | Credenciales de acceso |
| `Person` | Datos personales (nombre, apellido, etc.) |
| `Role` | Roles del sistema (admin, maestro, estudiante) |
| `PersonRole` | Relación Many-to-Many Person ↔ Role |
| `Contact` | Información de contacto |
| `SchoolPeriod` | Períodos escolares (años académicos) |
| `Grade` | Grados/Años escolares |
| `Section` | Secciones (A, B, C...) |
| `Subject` | Materias/Asignaturas |
| `PeriodGrade` | Relación Period ↔ Grade |
| `PeriodGradeSection` | Secciones por grado en un período |
| `PeriodGradeSubject` | Materias por grado en un período |
| `Inscription` | Inscripciones de estudiantes |
| `InscriptionSubject` | Materias inscrite por estudiante |
| `GradeEditPermission` | Permisos para editar notas de períodos anteriores |
| `GradeEditAudit` | Registro de auditoría de modificaciones de notas |

### Asociaciones Principales

```
User ──1:1──► Person ──1:1──► Contact
                │
                ├──M:N──► Role (through PersonRole)
                │
                └──1:N──► Inscription

SchoolPeriod ──M:N──► Grade (through PeriodGrade)
                           │
                           ├──M:N──► Section (through PeriodGradeSection)
                           └──M:N──► Subject (through PeriodGradeSubject)
```

---

## 📁 Estructura del Frontend

```
frontend/src/
├── App.tsx             # Componente raíz con rutas
├── main.tsx            # Punto de entrada
├── assets/             # Recursos estáticos
├── components/         # Componentes reutilizables
├── context/            # React Context (estado global)
├── hooks/              # Custom hooks
├── pages/              # Páginas por rol
│   ├── Login.tsx
│   ├── MainLayout.tsx
│   ├── shared/         # Componentes compartidos entre roles
│   │   ├── SearchUsers.tsx         # Búsqueda unificada (detecta rol)
│   │   └── EditUser.tsx            # Edición unificada (permisos por rol)
│   ├── master/         # Páginas exclusivas de Master
│   │   ├── AcademicManagement.tsx  # Gestión académica
│   │   ├── RegisterUser.tsx        # Registro de usuarios
│   │   └── MasterLayout.tsx        # Layout del módulo
│   └── admin/          # Páginas exclusivas de Admin
│       ├── EnrollStudent.tsx       # Inscripción de estudiantes
│       ├── RegisterStaff.tsx       # Registro de personal (Profesor/Representante)
│       └── AdminLayout.tsx         # Layout del módulo
├── routes/             # Configuración de rutas
├── services/           # Servicios API (Axios)
└── styles/             # Estilos globales
```

### Componentes Compartidos (`/pages/shared`)
Los componentes en esta carpeta detectan automáticamente el rol del usuario actual:
- **SearchUsers**: Muestra una etiqueta "Modo Master" cuando el usuario es Master
- **EditUser**: Habilita/deshabilita la edición de roles Admin/Master según el rol del usuario actual

---

## 🔐 Roles del Sistema

| Rol | Descripción | Permisos principales |
|-----|-------------|---------------------|
| **Master** | Super administrador | Gestión completa del sistema académico, gestión de permisos de edición de notas |
| **Administrador** | Administrador | Inscripciones, búsqueda de usuarios, gestión de permisos de edición de notas |
| **Control de Estudios** | Control de Estudios | Modificación de notas finales de períodos anteriores (con permiso), gestión académica |
| **Profesor** | Profesor | Gestión de calificaciones y evaluaciones |
| **Representante** | Representante | Consulta de expedientes de estudiantes a su cargo |
| **Alumno** | Estudiante | Acceso a calificaciones y evaluaciones |

---

## 🚀 Comandos de Desarrollo

### Backend
```bash
cd backend
npm run dev      # Inicia servidor de desarrollo con nodemon
npm run build    # Compila TypeScript
npm run start    # Ejecuta build de producción
```

### Frontend
```bash
cd frontend
npm run dev      # Inicia Vite dev server
npm run build    # Build de producción
npm run lint     # Ejecuta ESLint
npm run preview  # Preview del build
```

---

## 🔗 Configuración de Paths

El proyecto usa **path aliases** para imports más limpios:

### Backend (`tsconfig.json`)
```json
{
  "paths": {
    "@config/*": ["src/config/*"],
    "@controllers/*": ["src/controllers/*"],
    "@models/*": ["src/models/*"],
    "@routes/*": ["src/routes/*"],
    "@middlewares/*": ["src/middlewares/*"]
  }
}
```

### Frontend (`vite.config.ts` + `tsconfig.json`)
- Usa `vite-tsconfig-paths` para resolver paths automáticamente

---

## 🗄️ Base de Datos

- **Motor**: MySQL
- **ORM**: Sequelize 6
- **Configuración**: `backend/.env`
  ```env
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=
  DB_NAME=bp
  ```

---

## 📌 Funcionalidades Principales

### ✅ Implementadas
1. **Autenticación** - Login con sesiones
2. **Gestión de Usuarios** - CRUD completo con roles
3. **Gestión Académica** - Períodos, grados, secciones, materias
4. **Inscripciones** - Inscripción de estudiantes a períodos/grados/secciones
5. **Permisos de Edición de Notas** - Sistema para modificar notas finales de períodos anteriores
   - Master y Administrador pueden otorgar/revocar permisos
   - Control de Estudios puede modificar notas finales con permiso activo
   - Auditoría completa de todas las modificaciones de notas
   - Permisos pueden ser globales (todos los períodos) o específicos por período

### 🚧 En Desarrollo / Pendientes
- Sistema de calificaciones
- Dashboard de estudiantes
- Dashboard de profesores
- Reportes académicos

---

## 💡 Convenciones de Código

- **Idioma del código**: Inglés (nombres de variables, funciones, clases)
- **Idioma de la UI**: Español
- **Estilo de código**: TypeScript estricto
- **Componentes React**: Functional components con hooks
- **Estado global**: React Context API
- **Estilos**: Ant Design + Sass para personalizaciones

---

## 🐛 Notas para Debugging

1. El backend corre por defecto en `http://localhost:3000`
2. El frontend (Vite) corre en `http://localhost:5173`
3. CORS está configurado para permitir requests del frontend
4. Las sesiones usan cookies, asegurar `credentials: 'include'` en Axios

---

## 📝 Historial de Contexto

Este proyecto ha trabajado en:
- Configuración inicial del monorepo
- Sistema de autenticación con sesiones
- CRUD de usuarios con roles
- Estructura académica (períodos, grados, secciones, materias)
- Módulo de inscripción de estudiantes
- **Consolidación de componentes**: SearchUsers y EditUser unificados en `/pages/shared` con detección automática de permisos según rol (Master vs Admin)
- **Sistema de Permisos de Edición de Notas**: Implementación completa para modificar notas finales de períodos anteriores
  - Backend: Modelos GradeEditPermission y GradeEditAudit, controller gradeEditPermissionController, rutas gradeEditPermissionRoutes
  - Frontend: Panel de administración GradeEditPermissions.tsx, servicio gradeEditPermissionService.ts
  - Funcionalidad: Master/Admin otorgan permisos, Control de Estudios modifica notas con permiso activo y auditoría completa

---

*Última actualización: Abril 2026*
