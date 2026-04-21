# AGENTS.md – `backend/src/controllers`

> Lógica HTTP del backend. Un archivo por dominio. Referencia completa de endpoints: [`docs/backend-api.md`](../../../docs/backend-api.md).

## Convenciones

- Cada controller exporta funciones async `(req, res) => ...` que devuelven JSON.
- Operaciones multi-tabla → envueltas en `sequelize.transaction()`.
- Validaciones de rol se hacen leyendo `req.session.user.roles`. No hay middleware global aún.
- Errores: `console.error('[nombreFunction] ...')` + `res.status(x).json({ message: '...' })` en español.
- Imports de modelos van desde `@/models` (que re-exporta desde `index.ts` con asociaciones cargadas).

## Mapa rápido

| Controller | Dominio | Notas |
|------------|---------|-------|
| `authController` | Login/logout/me/register | Crea `req.session.user`. |
| `userController` | CRUD de usuarios/personas | Validación de permisos según rol editor. Transacción para cambio de representante. |
| `academicController` | Estructura académica | CRUD de períodos, grados, secciones, materias, groups, specializations + wiring via `structure/*`. Archivo grande. |
| `inscriptionController` | Inscripciones + matrículas | Contiene: createInscription, getInscriptions, register, quickRegister, getMatriculations, enrollMatriculatedStudent. ~47 KB. |
| `bulkEnrollmentController` | Carga masiva Excel | Delega en `bulkEnrollmentService`. |
| `teacherController` | Asignaciones docentes | Filtra por rol `Profesor` (NO `Teacher`). |
| `evaluationController` | Notas y planes | `my-assignments` filtra por `req.session.user.personId`. `updateFinalGrade` verifica permisos si el período está cerrado. |
| `guardianController` | Representantes | `searchGuardian` siempre retorna un `GuardianProfile.id` válido (no confundir con `Person.id`). |
| `gradeEditPermissionController` | Permisos de edición de notas | Valida roles Master/Admin para otorgar; escribe auditoría al editar. |
| `periodClosureController` | Cierre de período | status/validate/preview/execute. Ver `docs/flows/period-closure.md`. |
| `periodOutcomeController` | Resultados por período | outcomes + pending subjects. |
| `councilController` | Consejos de curso | `bulkSaveCouncilPoints` para guardado masivo. |
| `termController` | Lapsos | CRUD + reorder. |
| `plantelController` | Centros educativos | CRUD + search + by-code. |
| `enrollmentQuestionController` | Preguntas inscripción | CRUD + reorder + status. |
| `enrollmentAnswerController` | Respuestas inscripción | Upsert por personId. |
| `enrollmentReportController` | PDFs matrícula | Puppeteer, ruta pública por UUID. |
| `residenceController` | Dirección | Upsert por personId. |
| `locationController` | Catálogo Venezuela | Lee `src/assets/venezuela.json`. |
| `studentPreviousSchoolController` | Escuelas previas | CRUD + bulk-replace. |
| `dashboardController` | Métricas | `/control` y `/master`. |
| `dashboardContentController` | Contenido editable | Imágenes en `public/uploads/`. |
| `settingController` / `settingsController` | Key/value | Revisar cuál se usa (hay dos). |
| `uploadController` | Archivos | Logo + documentos genéricos. |
| `healthController` | Liveness | Probe simple. |

## Al añadir un controller nuevo

1. Crear archivo siguiendo el patrón existente.
2. Crear/actualizar la ruta en `backend/src/routes/<nombre>Routes.ts`.
3. Registrar en `backend/src/app.ts` (`app.use('/api/xxx', router)`).
4. Añadir al mapa de arriba y a `docs/backend-api.md`.
5. Si expone endpoints por rol, documentar en `docs/roles-permissions.md`.

## Patrones a seguir

```typescript
import { Request, Response } from 'express';
import sequelize from '@/config/database';
import { ModelX } from '@/models';

export const listX = async (req: Request, res: Response) => {
  try {
    const items = await ModelX.findAll();
    return res.json(items);
  } catch (error) {
    console.error('[listX] Error:', error);
    return res.status(500).json({ message: 'Error al listar' });
  }
};

export const createX = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const item = await ModelX.create(req.body, { transaction: t });
    await t.commit();
    return res.status(201).json(item);
  } catch (error) {
    await t.rollback();
    console.error('[createX] Error:', error);
    return res.status(500).json({ message: 'Error al crear' });
  }
};
```
