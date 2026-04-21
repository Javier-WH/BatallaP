# AGENTS.md – `frontend/src/components`

> Componentes reutilizables (no páginas). Si un componente vive dentro de una sola página,
> déjalo junto a ella (por ejemplo `frontend/src/pages/admin/components/`).

## Inventario

### Raíz de `components/`

| Archivo | Uso |
|---------|-----|
| `DashboardContent.tsx` | Render del contenido editable del dashboard (bloques + imágenes). Alimentado por `dashboardContentService`. |
| `EnrollmentQuestionFields.tsx` | Genera form fields dinámicos desde `EnrollmentQuestion[]`. Usado en wizards de inscripción/matrícula. |
| `BulkRetryModal.tsx` | Modal de reintento de filas fallidas del bulk-enrollment. Grande (~28 KB). |

### `components/shared/`

Componentes muy reutilizados entre módulos.

| Archivo | Uso |
|---------|-----|
| `PlantelAsyncSelect.tsx` | Combobox async de planteles, usa `/api/planteles/search`. |
| `PlantelSelectorModal.tsx` | Modal para seleccionar plantel. |
| `StudentPlantelesModal.tsx` | Gestión de planteles asociados al estudiante. |
| `SearchGuardianModal.tsx` | Buscar/crear representante por documento. Usa `/api/guardians/search` y devuelve un `GuardianProfile.id`. |
| `StudentAcademicRecord.tsx` | Expediente académico completo. Reutilizado en `StudentDetail`, `MyDossier`, `MyStudents`. ~33 KB. |

### `components/pdf/`

Plantillas de impresión/vista para PDFs (usadas con Puppeteer en backend o `react-to-print`).

## Convenciones

- Cada componente exporta `export default`.
- Props tipadas con `interface PropsX { ... }`.
- Si el componente consume datos del backend, idealmente recibe los datos por props y delega el fetch al caller. Excepción: `PlantelAsyncSelect` hace fetch internamente porque es un control autocomplete.
- Estilos con Ant Design + Sass si hace falta override (archivo `.scss` adyacente).

## Al añadir un componente nuevo

1. Decidir si es realmente reutilizable (≥ 2 consumidores). Si no, ponerlo junto a la página.
2. Colocarlo en `components/` si es genérico o `components/shared/` si ya lo usarán varios módulos.
3. Si depende de un servicio HTTP, crear/usar el service correspondiente en `src/services/`.
4. Actualizar `docs/frontend-modules.md` si es significativo.
