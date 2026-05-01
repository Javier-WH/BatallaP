# ✅ Checklist: Crear un nuevo modelo Sequelize

> Usar este checklist cada vez que se cree un nuevo modelo de base de datos.

## Antes de empezar
- [ ] Leer `rules/RULES.md` (Regla R1: asociaciones centralizadas)
- [ ] Verificar que el modelo no existe ya en `backend/src/models/`
- [ ] Definir las columnas, tipos y constraints

## Implementación

### 1. Archivo del modelo
- [ ] Crear `backend/src/models/NuevoModelo.ts`
- [ ] Nombre del archivo en PascalCase (ej: `StudentGuardian.ts`)
- [ ] Nombre de la tabla en snake_case pluralizado (ej: `student_guardians`)
- [ ] Definir columnas con tipos estrictos TypeScript
- [ ] Agregar timestamps si aplica (`createdAt`, `updatedAt`)

### 2. Asociaciones (⚠️ CRÍTICO)
- [ ] Agregar import del modelo en `backend/src/models/index.ts`
- [ ] Definir **TODAS** las asociaciones en `index.ts` (NUNCA en el archivo del modelo)
- [ ] Elegir alias descriptivo (ej: `{ as: 'student' }`, `{ as: 'grades' }`)
- [ ] Para M:N: crear modelo pivot si es necesario

### 3. Safety commit
- [ ] Ejecutar `git add -A && git commit -m "safety: before adding model [NuevoModelo]"`
- [ ] Esto es obligatorio porque `models/index.ts` es archivo crítico

## Documentación
- [ ] Actualizar `docs/database-models.md` con el nuevo modelo
- [ ] Agregar el modelo a la sección de dominio correspondiente
- [ ] Documentar asociaciones en el diagrama ASCII

## Verificación
- [ ] `npm run db:sync` ejecuta sin errores (crea la tabla)
- [ ] Ejecutar `.\rules\verify.ps1`
- [ ] TypeCheck pasa sin errors
