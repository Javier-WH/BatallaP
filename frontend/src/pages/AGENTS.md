# AGENTS.md – `frontend/src/pages`

> Páginas organizadas por rol. Registro de rutas en [`../App.tsx`](../App.tsx).
> Para el mapa completo: [`docs/frontend-modules.md`](../../../docs/frontend-modules.md).

## Reglas de organización

- **Una carpeta por rol**: `master/`, `admin/`, `control-estudios/`, `teacher/`, `representative/`, `student/`.
- **`shared/`**: páginas usadas por más de un rol, con detección de permisos interna.
- Cada carpeta tiene su `<Rol>Layout.tsx` con sidebar propio.
- Las páginas grandes (>30 KB) ya existen – si necesitas modificarlas, primero lee la sección correspondiente.

## Páginas grandes / complejas

| Página | Tamaño | Qué hace |
|--------|--------|---------|
| `control-estudios/MatriculationEnrollment.tsx` | ~78 KB | Wizard de matrícula multi-paso + bulk excel. Usa AG-Grid (`MatriculationAgGrid.tsx` + `matriculationColumns.tsx`). |
| `admin/EnrollStudent.tsx` | ~80 KB | Wizard de inscripción completo. |
| `master/AcademicManagement.tsx` | ~77 KB | Gestión académica total. |
| `control-estudios/FinalGradesEdit.tsx` | ~32 KB | Edición de notas con verificación de permisos. |
| `control-estudios/CourseCouncil.tsx` | ~32 KB | Consejo de curso. |
| `teacher/TeacherPanel.tsx` | ~30 KB | Panel profesor (plan + notas). |
| `components/BulkRetryModal.tsx` | ~28 KB | Reintento masivo de filas fallidas. |

Al modificar estas páginas, hacer cambios **localizados** y evitar refactors generales en la misma PR.

## Patrón de página

```tsx
export default function MyPage() {
  const { user } = useAuth();
  const canEdit = user?.roles.includes('Administrador') || user?.roles.includes('Master');
  // ...
}
```

## Uso de roles

- **Siempre** en español canónico: `'Master' | 'Administrador' | 'Control de Estudios' | 'Profesor' | 'Representante' | 'Alumno'`.
- NO usar `'Admin'`, `'Teacher'`, `'Student'` – rompe la protección de rutas.

## Navegación

- Al navegar al expediente: `navigate('/student/${personId}')`.
- Al editar un usuario: `navigate('${base}/edit/${id}')` donde `${base}` es `/master`, `/admin` o `/control-estudios` según el contexto.
- Volver con `navigate(-1)` para preservar la historia real (no hacer push manual del path anterior).

## Layouts

| Layout | Usado por |
|--------|-----------|
| `MainLayout.tsx` | Topbar + sidebar globales, siempre visible. Filtra menús por roles. |
| `MasterLayout.tsx` | Sub-sidebar de Master. |
| `AdminLayout.tsx` | Sub-sidebar de Admin. |
| `ControlEstudiosLayout.tsx` | Sub-sidebar de Control de Estudios. |
| `RepresentativeLayout.tsx` / `StudentLayout.tsx` | Layouts mínimos. |

## Al añadir una página nueva

1. Colocar en la carpeta del rol correspondiente (o `shared/` si aplica).
2. Registrar la ruta en `App.tsx` dentro del bloque `<RequireAuth allowedRoles={[...]}>`.
3. Añadir el item de menú en el layout del rol.
4. Actualizar `docs/frontend-modules.md` y `docs/roles-permissions.md`.
5. Si consume un endpoint nuevo, crear el service en `frontend/src/services/` si se reutilizará.
