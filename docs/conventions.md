# 💡 Convenciones de código

## Idioma

| Elemento | Idioma |
|----------|--------|
| Nombres de variables, funciones, clases, archivos | **Inglés** |
| Nombres de modelos Sequelize | **Inglés** (ej. `Inscription`, `GradeEditPermission`) |
| Rutas de API | **Inglés** (ej. `/api/inscriptions`) |
| Rutas del frontend (URLs visibles) | **Español** (ej. `/admin/inscribir-estudiante`) |
| UI / textos visibles | **Español** |
| Mensajes de error al usuario | **Español** |
| Comentarios en código | **Español** o inglés (consistente en el archivo) |
| Nombres de roles en BD | **Español** (`Master`, `Administrador`, `Control de Estudios`, `Profesor`, `Representante`, `Alumno`) |

## TypeScript

- **Modo estricto** habilitado en ambos `tsconfig.json`.
- Evitar `any`; usar interfaces tipadas. Si no se puede evitar, preferir `unknown` + narrowing.
- Interfaces para props de componentes y payloads de controllers.
- Tipos reutilizables en `backend/src/types/` (crear si no existe).

## Backend (Node/Express/Sequelize)

- **Controllers**: una función por endpoint. Devuelven `res.json(...)` o `res.status(x).json(...)`. No lanzan excepciones sin `try/catch`.
- **Services**: lógica de negocio pura reutilizable entre controllers. No tocan `req`/`res`.
- **Models**: un archivo por modelo en `backend/src/models/`. Todas las asociaciones van centralizadas en `backend/src/models/index.ts`.
- **Routes**: archivo por recurso en `backend/src/routes/`, registrado en `backend/src/app.ts`.
- **Transacciones**: usar `sequelize.transaction()` para operaciones multi-tabla (ej. actualización de representantes, cierre de período, inscripciones masivas).
- **Logs**: `console.log` / `console.error`. No hay logger formal todavía.
- **Validación**: manual dentro del controller (no se usa Joi/Zod aún).

### Patrón típico de controller
```typescript
export const createX = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    // lógica
    await t.commit();
    return res.status(201).json(result);
  } catch (error) {
    await t.rollback();
    console.error('[createX] Error:', error);
    return res.status(500).json({ message: 'Error...' });
  }
};
```

## Frontend (React/Vite/Ant Design)

- **Functional components** con hooks.
- **Estado global**: `AuthContext` (usuario autenticado) y `SchoolContext` (período activo, plantel, etc.).
- **UI**: Ant Design 6 como base. Customizaciones con Sass (archivos `.scss`).
- **Iconos**: `@ant-design/icons`. Lucide si hace falta algo fuera de AntD.
- **HTTP**: Axios con `withCredentials: true` vía instancia en `frontend/src/services/api.ts`. Servicios temáticos agrupados en `frontend/src/services/*.ts`.
- **Rutas**: todas centralizadas en `frontend/src/App.tsx`. Protección con `<RequireAuth allowedRoles={[...]}>`.
- **Organización de páginas**: una carpeta por rol (`master/`, `admin/`, `control-estudios/`, `teacher/`, `representative/`, `student/`) + `shared/` para páginas reutilizadas.

### Patrón típico de página
```tsx
import { useEffect, useState } from 'react';
import { Table, message } from 'antd';
import api from '@/services/api';

export default function MyPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Item[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/resource');
      setData(data);
    } catch (e) {
      message.error('Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  return <Table dataSource={data} loading={loading} />;
}
```

## Roles y permisos

Los nombres **exactos** aceptados por el backend y por `RequireAuth` son:
`Master`, `Administrador`, `Control de Estudios`, `Profesor`, `Representante`, `Alumno`.

⚠️ **Nunca** usar variantes en inglés (`Admin`, `Teacher`, `Student`) – rompen las comparaciones.

Ver [`roles-permissions.md`](./roles-permissions.md) para matriz completa.

## Tests

- Backend unit/integration: `backend/src/__tests__/` con Jest + supertest.
- Monorepo integration flows: `tests/` con su propia `package.json`.
- Ver [`../tests/README.md`](../tests/README.md) y [`../backend/README_TESTS.md`](../backend/README_TESTS.md).

## Git / Commits

- Sin convenciones estrictas (ej. conventional commits) establecidas.
- Recomendado: prefijos `feat:`, `fix:`, `refactor:`, `docs:`, `test:`.

## Estilo visual

- Componentes AntD con tema default.
- Customizaciones Sass van en `frontend/src/styles/` o junto al componente.
- `index.css` y `App.css` contienen resets y estilos globales.

## Archivos que NO deben tocarse sin coordinación

- `backend/src/models/index.ts` (centralización de asociaciones – un cambio mal hecho rompe todo).
- `backend/src/app.ts` (orden de middlewares importa).
- `backend/src/seed.ts` y seeders (cambian datos de usuarios de prueba).
- `frontend/src/App.tsx` (definición de rutas y `allowedRoles`).

Siempre revisar [`.windsurf/workflows/roles-and-access.md`](../.windsurf/workflows/roles-and-access.md) antes de modificar accesos/rutas.

## Orden canónico de materias

**Regla**: Toda lista de materias que se muestre en UI, se exporte en PDF o se envíe al frontend debe ordenarse por `PeriodGradeSubject.order` ASC del `PeriodGrade` correspondiente al contexto (período + grado de la inscripción), con fallback a `Subject.name` ASC cuando `order` sea nulo.

### Fuente de verdad

- El orden **no** está en la tabla `Subject` (catálogo reutilizable).
- El orden canónico vive en la tabla pivote `period_grade_subjects.order`, scoped por `(periodGradeId = schoolPeriodId + gradeId)`.
- Esto permite que la misma materia tenga distinto orden en distintos grados/períodos.

### Helper backend

Usar `backend/src/services/subjectOrderService.ts`:
- `getSubjectOrderMap(periodGradeId)` → `Map<subjectId, number>`
- `getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId)`
- `sortSubjectsByOrder<T>(items, getSubjectId, getSubjectName, orderMap)` con fallback alfabético.
- `sortSubjectsWithPendingAtEnd<T>` para listas con materias pendientes (estas van al final).

### Aplicación

**Backend** – Ordenar en controllers/servicios ANTES de enviar respuesta:
- `evaluationController`: `getStudentFullAcademicRecord`, `getFinalGradesByPeriod`
- `finalGradeCalculator`: `calculateForInscription`
- `periodOutcomeService`: `getOutcomesForPeriod` (pendientes alfabéticamente)
- `teacherController`: `getAvailableSubjectsForPeriod`
- `inscriptionController`: `getInscriptions`, `getInscriptionById`
- `councilController`: `getCouncilData`
- `academicController`: `getPeriodStructure` (ya ordena por through)

**Frontend** – Confíar en el orden del backend. No hacer `sort((a,b)=>a.name.localeCompare(b.name))` en listas de materias. Los sorts encontrados son para otras entidades (estudiantes, grados, secciones).

### Materias pendientes

Cuando una inscripción arrastra materias pendientes de un grado anterior:
- Materias del grado actual primero (en su orden canónico).
- Materias pendientes al final como bloque separado, ordenadas alfabéticamente por nombre.

## Formateo y redondeo de notas

**Regla**: Toda nota numérica que se muestre en la UI debe usar la función `formatGrade()` de `frontend/src/utils/gradeFormat.ts`, la cual aplica el redondeo según la configuración global.

### Configuración global

- El setting `enable_grade_rounding` (key: `'enable_grade_rounding'`, value: `'true'`/`'false'`) se gestiona en "Parámetros Académicos" (`AcademicSettings.tsx`).
- El backend **siempre** retorna valores exactos de la base de datos.
- El frontend es responsable de aplicar el redondeo **solo para visualización**.
- Cuando el setting cambia, el contexto `GradeRoundingContext` se actualiza automáticamente y todos los componentes que lo usan re-renderizan sin necesidad de recargar la página.

### Helper frontend

Usar `frontend/src/utils/gradeFormat.ts`:

```typescript
import { formatGrade } from '@/utils/gradeFormat';
import { useGradeRounding } from '@/context/GradeRoundingContext';

// En el componente
const { enableRounding } = useGradeRounding();

// Al mostrar una nota
<Text>{formatGrade(gradeValue, enableRounding)}</Text>
```

### Comportamiento

| Setting activado | Formato | Ejemplos |
|-----------------|---------|----------|
| **true** | 1 decimal, redondeo estándar (10.5 → 11) | `10.5` → `11.0`, `10.24` → `10.2`, `9.99` → `10.0` |
| **false** (default) | 2 decimales, sin redondeo | `10.5` → `10.50`, `10.24` → `10.24`, `9.99` → `9.99` |

### Aplicación

**Frontend** – Aplicar en todo componente que muestre notas numéricas:
- `TeacherPanel.tsx`: rowTotal
- `StudentAcademicRecord.tsx`: finalTermScore, avg
- `FinalGradesEdit.tsx`: average
- `CourseCouncil.tsx`: average, baseGrade, totalGrade

⚠️ **No aplicar** en:
- `InputNumber` para edición (mantener `precision={2}` para entrada exacta)
- Valores que se envían al backend (siempre enviar valores exactos)

### Regla de implementación

Al agregar una nueva vista que muestre notas:
1. Importar `useGradeRounding` y `formatGrade`
2. Usar `formatGrade(valor, enableRounding)` en todos los displays de notas
3. Mantener los inputs de edición sin redondeo (valores exactos)
