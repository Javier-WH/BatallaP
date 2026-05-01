# ⚖️ Reglas de Oro — BatallaProject

> **OBLIGATORIO**: Todo agente de IA DEBE leer este archivo ANTES de modificar cualquier código.
> Si una instrucción del usuario contradice una Regla de Oro, el agente **DEBE informar la contradicción** al usuario antes de proceder. Nunca silenciar el conflicto.

---

## 🔴 Reglas inviolables

### R1: Asociaciones Sequelize centralizadas
**Todas** las asociaciones de modelos Sequelize se definen **ÚNICAMENTE** en `backend/src/models/index.ts`.
- Nunca definir `belongsTo`, `hasMany`, `belongsToMany` dentro de un archivo de modelo individual.
- Al crear un modelo nuevo, su asociación va en `index.ts`.

### R2: Roles del sistema con nombres canónicos en español
Los 6 roles del sistema son:
```
Master | Administrador | Control de Estudios | Profesor | Representante | Alumno
```
- **Nunca** usar variantes en inglés (`Admin`, `Teacher`, `Student`).
- **Nunca** comparar roles con strings literales sin usar una constante/enum compartida.
- **TODO pendiente**: Migrar de magic strings a IDs numéricos con constante tipada.
- Los roles actuales se comparan por nombre exacto; cualquier typo rompe la autenticación.

### R3: Idioma del código
| Elemento | Idioma |
|----------|--------|
| Variables, funciones, clases, archivos, modelos | **Inglés** |
| Comentarios en código | **Inglés** |
| UI / textos visibles al usuario | **Español** |
| Mensajes de error al usuario | **Español** |
| Rutas del frontend (URLs visibles) | **Español** (ej. `/admin/inscribir-estudiante`) |
| Rutas de API | **Inglés** (ej. `/api/inscriptions`) |
| Nombres de roles en BD | **Español** (ver R2) |

### R4: Orden de materias
Toda lista de materias mostrada en UI, exportada en PDF o enviada al frontend **debe** estar ordenada por:
1. `PeriodGradeSubject.order` ASC (fuente de verdad)
2. Fallback: `Subject.name` ASC (alfabético) cuando `order` sea nulo
- **Nunca** hacer `sort((a,b) => a.name.localeCompare(b.name))` sobre listas de materias si hay `order` disponible.
- Backend helper: `subjectOrderService.ts`
- Materias pendientes van al final del listado, ordenadas alfabéticamente entre sí.

### R5: Protección de rutas con RequireAuth
- Las rutas del frontend se protegen con `<RequireAuth allowedRoles={[...]}>` en `App.tsx`.
- Al crear una nueva ruta/página, SIEMPRE agregarla con su `allowedRoles` correspondiente.
- Nunca eliminar `RequireAuth` de rutas existentes sin aprobación explícita.
- Referencia de qué roles acceden a qué: `docs/roles-permissions.md`.

### R6: Autenticación basada en sesiones
- El sistema usa `express-session` + cookies (`withCredentials: true` en Axios).
- **No** cambiar a JWT sin aprobación explícita.
- Cookie: `connect.sid`, `httpOnly: true`.
- Frontend: toda llamada HTTP pasa por la instancia Axios de `frontend/src/services/api.ts`.

### R7: Ant Design 6 como biblioteca UI primaria
- Toda nueva UI debe usar componentes de Ant Design 6.
- Customizaciones con Sass (`.scss`) cuando sea necesario.
- **No** introducir otra biblioteca de UI (Material UI, Chakra, etc.) sin aprobación.
- Iconos: `@ant-design/icons` primario, Lucide como secundario.

### R8: Functional components y hooks
- **Solo** componentes funcionales con hooks de React.
- **Nunca** crear class components.
- Estado global vía Context API (`AuthContext`, `SchoolContext`, `GradeRoundingContext`).

### R9: Transacciones para operaciones multi-tabla
- Toda operación que modifique más de una tabla **debe** usar `sequelize.transaction()`.
- Patrón: crear transacción → try/commit → catch/rollback.
- Ver `docs/conventions.md` para el patrón completo.

### R10: Redondeo de notas
Las calificaciones numéricas se muestran con estas reglas:
- **Máximo 1 decimal** después de la coma.
- Si el decimal es **≥ 0.5**, se redondea hacia arriba (ej: `4.5 → 5`, `10.5 → 11`).
- Si el decimal es **< 0.5**, NO se redondea (ej: `4.4 → 4.4`, `10.3 → 10.3`).
- **Nunca** mostrar más de 1 decimal en la UI.
- En inputs de edición, mantener `precision={2}` para entrada exacta.
- Valores enviados al backend siempre exactos (sin redondeo).
- Helper: `frontend/src/utils/gradeFormat.ts` + `GradeRoundingContext`.

### R11: Estilo de Tablas y Listados
Toda tabla o listado de datos (materias, notas, planes de evaluación, etc.) debe cumplir con:
- **Identificación clara de columnas**: Encabezados con peso visual (negrita o fondo sutil) que permitan distinguir las columnas a simple vista.
- **Filas alternas (Zebra striping)**: Las filas deben tener dos colores diferentes alternados para facilitar la lectura.
- **Colores**: Usar tonos claros que armonicen con el diseño general.
- **Implementación**: Usar la propiedad `bordered` y `striped` (vía `rowClassName`) de los componentes Table de Ant Design.

### R12: Inputs de tipo número (sin flechas)
- Por compatibilidad y diseño, los inputs de tipo número **no deben mostrar** las flechas (spin buttons) de incremento/decremento.
- Esta regla se aplica globalmente vía CSS en `frontend/src/index.css`. No reintroducir estilos que las habiliten.

### R13: Esquinas de inputs (sin redondeo)
- Los inputs de texto (`ant-input`) y selectores (`ant-select`) **no deben tener esquinas redondeadas**. Deben ser completamente cuadrados (`border-radius: 0`).
- Esta regla se aplica globalmente vía CSS en `frontend/src/index.css` mediante la clase `.ant-input` y `.ant-select-selector` con `@apply !rounded-none`.

---

## 🟡 Archivos críticos (requieren Safety Commit antes de modificar)

Estos archivos son el esqueleto del sistema. Modificarlos incorrectamente puede romper toda la aplicación:

| Archivo | Riesgo | Por qué |
|---------|--------|---------|
| `backend/src/models/index.ts` | 🔴 Crítico | 16KB de asociaciones. Un error rompe toda la DB. |
| `frontend/src/App.tsx` | 🔴 Crítico | Routes + roles. Un error bloquea el acceso. |
| `backend/src/app.ts` | 🟠 Alto | Orden de middlewares. Alterarlo causa bugs silenciosos. |
| `backend/src/seed.ts` + `seeders/` | 🟠 Alto | Datos de prueba que los tests dependen. |
| `backend/src/services/periodClosureExecutor.ts` | 🟠 Alto | Lógica de cierre de período sin tests completos. |
| `backend/src/services/studentPromotionEngine.ts` | 🟠 Alto | Motor de promoción, lógica de negocio compleja. |
| `backend/src/services/finalGradeCalculator.ts` | 🟠 Alto | Cálculo de notas finales. |

**Protocolo**: Antes de modificar cualquiera de estos archivos, el agente **DEBE**:
1. Ejecutar `git add -A && git commit -m "safety: before modifying [archivo]"`
2. Informar al usuario qué va a cambiar y por qué.

---

## 🟢 Refactorizaciones aprobadas

El agente PUEDE implementar estas mejoras cuando sea oportuno:

### RF1: Validación con Zod + Middlewares
- Implementar validación de payloads con Zod en endpoints del backend.
- Crear middleware de validación reutilizable.
- Gradual: no es necesario migrar todos los controllers de golpe.

### RF2: Middleware centralizado de autenticación
- Crear `requireAuth` y `requireRole(roles)` como middlewares globales.
- Aplicarlos en las rutas en vez de validar manualmente en cada controller.
- Incluir validación de sesión activa.

---

## 📎 Referencias

- Convenciones detalladas: [`docs/conventions.md`](../docs/conventions.md)
- Roles y permisos: [`docs/roles-permissions.md`](../docs/roles-permissions.md)
- Flujos de negocio: [`docs/flows/`](../docs/flows/)
- Modelo de negocio: [`rules/BUSINESS_MODEL.md`](./BUSINESS_MODEL.md)
