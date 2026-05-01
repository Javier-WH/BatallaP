# ✅ Checklist: Crear un nuevo endpoint

> Usar este checklist cada vez que se agregue un endpoint REST al backend.

## Antes de empezar
- [ ] Leer `rules/RULES.md` (Reglas de Oro)
- [ ] Verificar que el endpoint no existe ya en `docs/backend-api.md`
- [ ] Identificar qué rol(es) pueden acceder

## Backend

### 1. Modelo (si aplica)
- [ ] Crear archivo del modelo en `backend/src/models/NuevoModelo.ts`
- [ ] Agregar asociaciones en `backend/src/models/index.ts` (**NO** en el archivo del modelo)
- [ ] Exportar el modelo desde `index.ts`

### 2. Service (si hay lógica de negocio)
- [ ] Crear `backend/src/services/nuevoService.ts`
- [ ] No tocar `req`/`res` en el service (solo lógica pura)
- [ ] Usar `sequelize.transaction()` si toca múltiples tablas

### 3. Controller
- [ ] Crear/actualizar controller en `backend/src/controllers/`
- [ ] Seguir el patrón: `try/catch` → `transaction` → `commit/rollback`
- [ ] Validar input (Zod + middleware cuando aplique)
- [ ] Mensajes de error en **español** para el usuario
- [ ] Logging con prefijo: `console.error('[functionName] Error:', error)`

### 4. Route
- [ ] Crear/actualizar route en `backend/src/routes/`
- [ ] Registrar en `backend/src/app.ts` con la ruta `/api/...`

### 5. Tests
- [ ] Agregar test unitario en `backend/src/__tests__/` o test de integración en `tests/modules/`

## Documentación
- [ ] Actualizar `docs/backend-api.md` con el nuevo endpoint
- [ ] Si toca un flujo de negocio, actualizar `docs/flows/*.md`
- [ ] Si crea un modelo nuevo, actualizar `docs/database-models.md`

## Verificación
- [ ] Ejecutar `.\rules\verify.ps1`
- [ ] TypeCheck pasa sin errors nuevos
- [ ] Tests existentes siguen pasando
