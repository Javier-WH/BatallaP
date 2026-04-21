# AGENTS.md – `frontend/src/services`

> Clientes HTTP agrupados por dominio. Todos consumen la instancia `api` (axios con `withCredentials: true`).

## Archivos

| Archivo | Endpoint base | Notas |
|---------|---------------|-------|
| `api.ts` | — | Instancia axios central. `baseURL = VITE_API_URL || http://localhost:3000/api`. **No modificar sin coordinar.** |
| `academic.ts` | `/academic` | Wrappers ligeros. |
| `bulkEnrollment.ts` | `/inscriptions/bulk` | template/preview/process/retry. |
| `guardians.ts` | `/guardians` | search, create, my-students. |
| `enrollmentQuestions.ts` | `/enrollment-questions` | CRUD + reorder + status. |
| `enrollmentReportService.ts` | `/enrollment-reports` | generate/getByUuid/listByPerson. |
| `periodClosure.ts` | `/period-closure` | status/validate/preview/execute/checklist. |
| `periodOutcomeService.ts` | `/periods` | outcomes/pending. |
| `finalGradeEditService.ts` | `/evaluation/final-grade` | editar nota final con permiso. |
| `gradeEditPermissionService.ts` | `/grade-edit-permissions` | CRUD permisos + audit. |
| `dashboardContentService.ts` | `/dashboard-content` | Contenido editable. |

## Convenciones

- Exportar **funciones nombradas** (no default object) para mejor tree-shaking.
- Retornar `response.data` directamente (no la respuesta axios entera), salvo cuando se necesiten headers.
- Tipar el return con interfaces compartidas (idealmente en el mismo archivo o en `src/types` si se reutiliza).

### Ejemplo

```ts
import api from './api';

export interface Permission { id: number; /* ... */ }

export async function listPermissions(params?: { periodId?: number }): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>('/grade-edit-permissions', { params });
  return data;
}
```

## Cuándo crear un service vs llamar `api` directo

- **Service**: si la llamada se reutiliza en ≥ 2 páginas, o si encapsula lógica (transformaciones, merges, retries).
- **Directo (`api.get`)**: llamada única desde una sola página, lógica trivial.

## Ver también

- [`docs/backend-api.md`](../../../docs/backend-api.md) – endpoints disponibles.
- [`docs/frontend-modules.md`](../../../docs/frontend-modules.md).
