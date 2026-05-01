# ✅ Checklist: Crear una nueva página del frontend

> Usar este checklist cada vez que se agregue una página/vista nueva al frontend.

## Antes de empezar
- [ ] Leer `rules/RULES.md` (Reglas de Oro)
- [ ] Identificar en qué módulo va la página (por rol): `master/`, `admin/`, `control-estudios/`, `teacher/`, `representative/`, `student/`, `shared/`
- [ ] Identificar qué rol(es) pueden acceder
- [ ] Verificar que la ruta no existe ya en `frontend/src/App.tsx`

## Implementación

### 1. Página
- [ ] Crear archivo en `frontend/src/pages/{modulo}/NuevaPagina.tsx`
- [ ] Usar **functional component** con hooks
- [ ] Usar componentes de **Ant Design 6** para la UI
- [ ] Textos visibles en **español**
- [ ] Código y comentarios en **inglés**

### 2. Service (si necesita llamar al backend)
- [ ] Crear/actualizar service en `frontend/src/services/`
- [ ] Usar la instancia de Axios de `frontend/src/services/api.ts` (tiene `withCredentials: true`)
- [ ] Tipar respuestas con interfaces TypeScript

### 3. Ruta
- [ ] Agregar ruta en `frontend/src/App.tsx`
- [ ] Envolver con `<RequireAuth allowedRoles={['RolEspañol']}>`
- [ ] Usar nombres de rol **exactos** en español (ver R2 en RULES.md)

### 4. Navegación
- [ ] Agregar entrada en el menú lateral del Layout correspondiente (`MainLayout.tsx` o el layout del módulo)
- [ ] Icono apropiado de `@ant-design/icons`

### 5. Notas (si la página muestra calificaciones)
- [ ] Importar `useGradeRounding` y `formatGrade`
- [ ] Aplicar `formatGrade(valor, enableRounding)` en displays
- [ ] No aplicar redondeo en inputs de edición

### 6. Materias (si la página muestra listas de materias)
- [ ] NO hacer sort local por nombre
- [ ] Confiar en el orden del backend (`PeriodGradeSubject.order`)
- [ ] Materias pendientes al final si aplica

### 7. Tablas y Listados (si aplica)
- [ ] Columnas claramente identificadas (headers en negrita o fondo sutil)
- [ ] Filas alternas (zebra striping / striped) habilitadas
- [ ] Colores claros y coherentes con el diseño

## Documentación
- [ ] Actualizar `docs/frontend-modules.md`
- [ ] Actualizar `docs/roles-permissions.md` si agrega accesos nuevos
- [ ] Actualizar `frontend/src/pages/AGENTS.md`

## Verificación
- [ ] Ejecutar `.\rules\verify.ps1`
- [ ] TypeCheck pasa sin errors nuevos
- [ ] La página renderiza correctamente
- [ ] Verificar acceso con el rol correcto (y rechazo con roles incorrectos)
