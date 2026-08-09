# AGENTS.md – `backend/src/routes`

> Mapeo express entre ruta HTTP y controller. Registro central en [`../app.ts`](../app.ts).

## Convenciones

- Un archivo por dominio, nombre `<dominio>Routes.ts`.
- Exporta `export default router`.
- Importar funciones del controller con `import { ... } from '@/controllers/xxxController'`.
- Si la ruta requiere upload de archivos, importar el middleware correspondiente de `@/middlewares`.
- Al añadir una ruta nueva: registrarla también en `app.ts` con su prefijo `/api/...` y actualizar [`docs/backend-api.md`](../../../docs/backend-api.md).

## Namespaces actuales

| Prefijo en `app.ts` | Archivo |
|---------------------|---------|
| `/api/auth` | `authRoutes.ts` |
| `/api/users` | `userRoutes.ts` |
| `/api/users/:personId/student-previous-schools` | `studentPreviousSchoolRoutes.ts` |
| `/api/academic` | `academicRoutes.ts` |
| `/api/inscriptions` | `inscriptionRoutes.ts` |
| `/api/inscriptions/bulk` | `bulkEnrollmentRoutes.ts` |
| `/api/matriculations` | `matriculationRoutes.ts` |
| `/api/teachers` | `teacherRoutes.ts` |
| `/api/evaluation` | `evaluationRoutes.ts` |
| `/api/settings` | `settingRoutes.ts` |
| `/api/upload` | `uploadRoutes.ts` |
| `/api/terms` | `termRoutes.ts` |
| `/api/residences` | `residenceRoutes.ts` |
| `/api/locations` | `locationRoutes.ts` |
| `/api/planteles` | `plantelRoutes.ts` |
| `/api/enrollment-questions` | `enrollmentQuestionRoutes.ts` |
| `/api/enrollment-answers` | `enrollmentAnswerRoutes.ts` |
| `/api/enrollment-reports` | `enrollmentReportRoutes.ts` |
| `/api/guardians` | `guardianRoutes.ts` |
| `/api/council` | `councilRoutes.ts` |
| `/api/grade-edit-permissions` | `gradeEditPermissionRoutes.ts` |
| `/api/period-closure` | `periodClosureRoutes.ts` |
| `/api/periods` | `periodOutcomeRoutes.ts` |
| `/api/dashboard` | `dashboardRoutes.ts` |
| `/api/dashboard-content` | `dashboardContentRoutes.ts` |
| `/api/health` | `healthRoutes.ts` |
| `/api/external-grades` | `externalGradeRoutes.ts` |

## Orden en `app.ts`

El orden de `app.use(...)` importa cuando hay rutas anidadas. Ejemplo:
- `/api/inscriptions/bulk` debe registrarse **después** (o separado) de `/api/inscriptions` con un prefijo específico para no colisionar.
- `/api/users/:personId/student-previous-schools` está registrado por separado con prefijo explícito.

## Pattern para rutas con params anidados

```typescript
const router = Router({ mergeParams: true });  // ← clave
router.get('/', handler);  // accede a req.params.personId
```

Ver `studentPreviousSchoolRoutes.ts`.
