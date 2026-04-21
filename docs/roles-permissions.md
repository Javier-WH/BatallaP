# 🔐 Roles y permisos

## Nombres canónicos de roles

Los seis roles del sistema, exactamente como aparecen en la tabla `roles` y en `allowedRoles` del frontend:

| Rol | Descripción |
|-----|-------------|
| `Master` | Super administrador del sistema |
| `Administrador` | Administrador operativo |
| `Control de Estudios` | Personal de control de estudios |
| `Profesor` | Docente |
| `Representante` | Representante legal de un estudiante |
| `Alumno` | Estudiante |

⚠️ Nunca usar variantes en inglés (`Admin`, `Teacher`, `Student`). Ver workflow [`roles-and-access.md`](../.windsurf/workflows/roles-and-access.md).

## Matriz de accesos por rol

### Rutas protegidas (frontend – `frontend/src/App.tsx`)

| Ruta | Roles permitidos |
|------|------------------|
| `/dashboard` | Autenticado (cualquier rol) |
| `/master/*` | `Master` |
| `/admin/*` | `Administrador`, `Master` |
| `/control-estudios/*` | `Control de Estudios`, `Administrador`, `Master` |
| `/profesor` | `Profesor` |
| `/representante` | `Representante` |
| `/estudiante` | `Alumno` |
| `/gestion-usuarios` | `Master`, `Administrador` |
| `/student/:personId` (expediente) | `Administrador`, `Master`, `Control de Estudios`, `Representante`, `Alumno` |

### Submódulos principales

| Submódulo | URL | Roles |
|-----------|-----|-------|
| Gestión académica (Master) | `/master` | `Master` |
| Registrar usuario (Master) | `/master/register` | `Master` |
| Directorio de usuarios | `/master/directorio`, `/admin/directorio`, `/admin/search`, `/control-estudios/search` | según padre |
| Editar usuario | `/master/edit/:id`, `/admin/edit/:id`, `/control-estudios/edit/:id` | según padre |
| Settings del sistema | `/master/settings` | `Master` |
| Registrar personal | `/admin/register-staff` | `Administrador`, `Master` |
| Inscribir estudiante | `/admin/inscribir-estudiante` | `Administrador`, `Master` |
| Matricular estudiante | `/admin/matricular-estudiante`, `/control-estudios/matricular-estudiante` | según padre |
| Registrar representante | `/admin/registrar-representante` | `Administrador`, `Master` |
| Proyección de profesores | `/admin/projection` | `Administrador`, `Master` |
| Planteles | `/admin/planteles` | `Administrador`, `Master` |
| Preguntas de inscripción | `/admin/enrollment-questions` | `Administrador`, `Master` |
| Permisos de edición de notas | `/admin/permisos-edicion-notas` | `Administrador`, `Master` |
| Configuración académica | `/control-estudios/configuracion` | `Control de Estudios`, `Administrador`, `Master` |
| Consejos de curso | `/control-estudios/consejos-curso` | `Control de Estudios`, `Administrador`, `Master` |
| Editar notas finales | `/control-estudios/editar-notas` | `Control de Estudios` + permiso activo |
| Panel profesor | `/profesor` | `Profesor` |
| Mis estudiantes (rep.) | `/representante` | `Representante` |
| Mi expediente | `/estudiante` | `Alumno` |

## Funcionalidades por rol

### Master
- Acceso total al sistema.
- Gestionar períodos escolares, grados, secciones, materias, especializaciones, subject groups.
- Registrar cualquier tipo de usuario y asignar cualquier rol.
- Gestionar settings globales (logo, dashboard content).
- Otorgar/revocar permisos de edición de notas.
- Ver auditoría de modificaciones.

### Administrador
- Registrar personal (Profesor, Representante).
- Inscribir y matricular estudiantes.
- Búsqueda y edición de usuarios (no puede tocar rol Master).
- Gestión de planteles.
- Configurar preguntas de inscripción.
- Proyección de asignaciones de profesores.
- Otorgar/revocar permisos de edición de notas.

### Control de Estudios
- Matricular estudiantes.
- Configuración académica.
- Gestionar consejos de curso.
- **Editar notas finales de períodos anteriores** – requiere permiso activo otorgado por Master o Administrador. Toda edición queda auditada en `GradeEditAudit`.
- Buscar y editar usuarios (con restricciones similares a Administrador).

### Profesor
- Ver sus asignaciones activas (`/api/evaluation/my-assignments`).
- Crear/editar/eliminar ítems del plan de evaluación para sus asignaciones.
- Registrar calificaciones de sus estudiantes.
- Acceder a plantilla de consejo de curso para sus asignaturas.

### Representante
- Ver lista de sus representados (`/api/guardians/my-students`).
- Acceder al expediente académico (`/student/:personId`) de los estudiantes a su cargo.

### Alumno
- Ver su propio expediente académico.
- Ver calificaciones y período activo.

## Control de acceso en el backend

- **Autenticación**: basada en sesiones (`express-session` + `connect-session-sequelize`). Cookie `connect.sid` httpOnly.
- **Endpoint de sesión**: `GET /api/auth/me` devuelve usuario + roles.
- **Verificación de roles**: hoy se hace principalmente en cada controller individual cuando aplica (ej. `gradeEditPermissionController` valida que el solicitante sea Master o Administrador). No existe un middleware global `requireRole('X')`.
- **Filtrado de datos**: algunos controllers filtran resultados según el rol del usuario (ej. `evaluationController.getMyAssignments` sólo devuelve las asignaciones del profesor logueado).

## Reglas de edición de usuarios

En `EditUser.tsx` + `userController.updateUser`:

| Editor (rol actual) | Puede editar a | Restricciones |
|---------------------|----------------|---------------|
| `Master` | Cualquier usuario | Sin restricciones |
| `Administrador` | Cualquier excepto otros `Master` | No puede otorgar rol `Master` |
| `Control de Estudios` | Estudiantes y sus datos relacionados | Según componente, sin editar roles administrativos |

## Ruta para desarrolladores

Al añadir un submódulo nuevo:
1. Definir rol(es) requeridos.
2. Agregar la ruta protegida en `frontend/src/App.tsx` con `<RequireAuth allowedRoles={[...]}>`.
3. Añadir el item al menú en `MainLayout.tsx` (o al layout del módulo) usando los mismos roles.
4. Si el backend necesita verificar rol, extraer de `req.session.user.roles` en el controller.
5. Actualizar esta tabla y el `AGENTS.md` raíz.
