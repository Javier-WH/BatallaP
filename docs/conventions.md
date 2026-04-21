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
