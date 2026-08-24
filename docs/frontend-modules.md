# 🎨 Módulos del frontend

> Frontend: React 19 + TypeScript + Vite 7 + Ant Design 6 + React Router 7 + Axios.

## Estructura general

```
frontend/src/
├── main.tsx              # Entrypoint
├── App.tsx               # Router y rutas protegidas (RequireAuth)
├── index.css / App.css   # Estilos globales
├── assets/               # Recursos estáticos
├── context/              # AuthContext, SchoolContext
├── hooks/                # Custom hooks
├── data/                 # Datos estáticos (catálogos, etc.)
├── components/           # Componentes reutilizables (ver abajo)
├── pages/                # Páginas por rol (ver abajo)
├── services/             # Clientes HTTP (Axios) por dominio
└── styles/               # Sass globales
```

## 🔀 Routing – `App.tsx`

Rutas agrupadas por rol. Toda ruta interna pasa por `<MainLayout />` y es envuelta por `<RequireAuth allowedRoles={[...]}>`. Ver [`roles-permissions.md`](./roles-permissions.md) para la matriz completa.

## 🌐 Contextos globales – `src/context/`

| Archivo | Qué expone |
|---------|-----------|
| `AuthContext.tsx` | `useAuth()` → `{ user, loading, login, logout, refresh }`. `user` trae `id`, `username`, `roles: string[]`. |
| `SchoolContext.tsx` | `useSchool()` → datos de contexto escolar (ej. período activo, plantel). |

## 📡 Services HTTP – `src/services/`

Todos los servicios consumen la instancia `api` con `withCredentials: true`.

| Archivo | Endpoint base | Propósito |
|---------|---------------|-----------|
| `api.ts` | `VITE_API_URL` o `http://localhost:3000/api` | Instancia axios centralizada. |
| `academic.ts` | `/academic` | Wrappers ligeros para catálogos académicos. |
| `bulkEnrollment.ts` | `/inscriptions/bulk` | Template, preview, process, retry de carga masiva. |
| `guardians.ts` | `/guardians` | Búsqueda y creación de representantes. |
| `enrollmentQuestions.ts` | `/enrollment-questions` | CRUD de preguntas. |
| `enrollmentReportService.ts` | `/enrollment-reports` | Generación y consulta de reportes PDF. |
| `periodClosure.ts` | `/period-closure` | Cierre de período: status, validate, preview, execute. |
| `periodOutcomeService.ts` | `/periods` | Outcomes y pendientes. |
| `finalGradeEditService.ts` | `/evaluation/final-grade` | Edición de nota final con permiso. |
| `gradeEditPermissionService.ts` | `/grade-edit-permissions` | CRUD de permisos + auditoría. |
| `dashboardContentService.ts` | `/dashboard-content` | Contenido editable del dashboard. |

> Algunas páginas llaman directamente a `api.get/post(...)` sin archivo de service. Mantener ese patrón para llamadas ad-hoc; centralizar en un service cuando se reutilicen en varias páginas.

## 🧩 Componentes compartidos – `src/components/`

| Archivo | Uso |
|---------|-----|
| `DashboardContent.tsx` | Render del contenido editable (bloques + imágenes). |
| `EnrollmentQuestionFields.tsx` | Campos dinámicos generados desde preguntas de inscripción. |
| `BulkRetryModal.tsx` | Modal para reintentar filas fallidas de carga masiva. |
| `pdf/` | Componentes orientados a generación/visualización PDF. |
| `shared/PlantelAsyncSelect.tsx` | Combobox con autocomplete de planteles. |
| `shared/PlantelSelectorModal.tsx` | Modal selector de plantel. |
| `shared/SearchGuardianModal.tsx` | Modal para buscar/crear representante y asignarlo. |
| `shared/StudentAcademicRecord.tsx` | Expediente académico completo (reutilizado en varias páginas). |
| `shared/StudentPlantelesModal.tsx` | Gestión de planteles del estudiante. |

## 📄 Páginas por rol – `src/pages/`

### Raíz
| Archivo | Descripción |
|---------|-------------|
| `Login.tsx` | Pantalla de login. |
| `MainLayout.tsx` | Layout global con sidebar y topbar. Filtra menús por roles. |
| `GeneralDashboard.tsx` | Dashboard genérico post-login (antes de entrar a un módulo). |
| `NotFound.tsx` | Página 404. |

### Shared (reutilizadas entre roles)
| Archivo | Descripción |
|---------|-------------|
| `shared/SearchUsers.tsx` | Búsqueda unificada de usuarios; muestra "Modo Master" si aplica. |
| `shared/EditUser.tsx` | Edición unificada; habilita/deshabilita edición de roles según rol del editor. |
| `shared/DashboardEditor.tsx` | Editor del contenido del dashboard (modo visual/WYSIWYG). |
| `shared/DashboardEditorManual.tsx` | Variante manual del editor (edición por bloques). |

### Master (`/master/*`)
| Archivo | Descripción |
|---------|-------------|
| `master/MasterLayout.tsx` | Layout del módulo. |
| `master/Dashboard.tsx` | Dashboard Master con métricas avanzadas. |
| `master/RegisterUser.tsx` | Registrar cualquier usuario con cualquier rol. |
| `master/AcademicManagement.tsx` | Gestión completa de estructura académica (~77 KB). Es la página más grande: CRUD de períodos, grados, secciones, materias, subject groups, especializaciones y wiring período-grado-sección-materia. |
| `master/SettingsManagement.tsx` | Gestión de settings y contenido del dashboard. |

### Admin (`/admin/*`)
| Archivo | Descripción |
|---------|-------------|
| `admin/AdminLayout.tsx` | Layout del módulo. |
| `admin/Dashboard.tsx` | Dashboard administrativo. |
| `admin/RegisterStaff.tsx` | Registrar personal (Profesor/Representante). |
| `admin/RegisterRepresentative.tsx` | Registrar solo Representante. |
| `admin/EnrollStudent.tsx` | Página de inscripción con 4 pestañas: "Nuevo Ingreso", "Preinscripción", "Inscripción masiva" (Excel) y "Estudiante Regular". Las dos primeras usan el componente `NewStudentEnrollmentForm` con `mode="inscripcion"` y `mode="preinscripcion"` respectivamente. |
| `admin/components/NewStudentEnrollmentForm.tsx` | Formulario extraído de inscripción/preinscripción de nuevo estudiante. Recibe `mode`, `allPeriods`, `venezuelaLocations` y `onPeriodsChanged`. En modo `preinscripcion` selecciona automáticamente el período con `status: 'preinscripcion'`; si no existe, ofrece crearlo vía `ensurePreinscriptionPeriod()`. |
| `admin/QuickEnrollStudent.tsx` | Inscripción rápida con datos mínimos. |
| `admin/StudentSubjectsModal.tsx` | Modal para gestionar materias (grupos electivos) del estudiante. |
| `admin/SchoolManagement.tsx` | CRUD de planteles. |
| `admin/EnrollmentQuestions.tsx` | Gestión de preguntas del formulario de inscripción. |
| `admin/GradeEditPermissions.tsx` | Panel para otorgar/revocar permisos de edición de notas. |
| `admin/TeacherProjection.tsx` | Proyección de asignaciones de profesores por período. |

### Control de Estudios (`/control-estudios/*`)
| Archivo | Descripción |
|---------|-------------|
| `control-estudios/ControlEstudiosLayout.tsx` | Layout del módulo. |
| `control-estudios/Dashboard.tsx` | Panel con métricas. |
| `control-estudios/AcademicSettings.tsx` | Configuración académica (terms, reglas, políticas). |
| `control-estudios/MatriculationEnrollment.tsx` | Flujo de matrícula masiva / avanzada (~134 KB, el archivo más grande). Incluye wizard multi-paso, subida de documentos, carga masiva por Excel, validación de datos. |
| `control-estudios/CourseCouncil.tsx` | Consejo de curso: revisar/ajustar notas propuestas por lapso. |
| `control-estudios/FinalGradesEdit.tsx` | Edición de notas finales de períodos anteriores (requiere permiso + audita). |
| `control-estudios/ExternalGrades.tsx` | Registro de notas externas (transferencia/equivalencia) con plantel emisor. Tabs: individual, listado, carga masiva Excel. |
| `control-estudios/RegisterRepresentative.tsx` | Re-export o wrapper del módulo admin. |

### Profesor (`/profesor`)
| Archivo | Descripción |
|---------|-------------|
| `teacher/TeacherPanel.tsx` | Panel único del profesor (~30 KB). Tabs: mis asignaciones, plan de evaluación, registro de notas por estudiante. |

### Representante (`/representante`)
| Archivo | Descripción |
|---------|-------------|
| `representative/RepresentativeLayout.tsx` | Layout. |
| `representative/MyStudents.tsx` | Lista de estudiantes a cargo con link al expediente. |

### Alumno (`/estudiante`)
| Archivo | Descripción |
|---------|-------------|
| `student/StudentLayout.tsx` | Layout. |
| `student/MyDossier.tsx` | Wrapper del expediente del propio estudiante. |
| `student/StudentDetail.tsx` | Expediente académico (reutilizado por todos los roles con acceso). |

## 🪝 Patrones comunes

- **Protección de rutas**: `<RequireAuth allowedRoles={['Rol1','Rol2']}>`.
- **Menús dinámicos**: `MainLayout` filtra el sidebar usando `user.roles`.
- **Navegación al expediente**: siempre `navigate('/student/:personId')`; pasar estado opcional con `state` para preservar historial.
- **Botón editar desde expediente**: visible sólo para `Master`, `Administrador`, `Control de Estudios`. Al navegar a `edit/:id` se preserva historia y `navigate(-1)` vuelve al punto anterior.
- **Roles en español**: nunca comparar con `'Admin'`, `'Teacher'`, `'Student'`. Usar siempre los nombres canónicos.

## Ver también

- [`roles-permissions.md`](./roles-permissions.md)
- [`backend-api.md`](./backend-api.md)
- [`conventions.md`](./conventions.md)
- [`frontend/src/pages/AGENTS.md`](../frontend/src/pages/AGENTS.md)
- [`frontend/src/services/AGENTS.md`](../frontend/src/services/AGENTS.md)
- [`frontend/src/components/AGENTS.md`](../frontend/src/components/AGENTS.md)
