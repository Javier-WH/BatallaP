# 🔓 Flujo: Edición de notas finales de períodos cerrados

> Diseño original: [`../notes/sistema-edicion-notas.md`](../../notes/sistema-edicion-notas.md).

## Objetivo

Permitir que `Control de Estudios` modifique `SubjectFinalGrade` de períodos ya cerrados, bajo un permiso explícito otorgado por `Master` o `Administrador`, y con auditoría completa de cada cambio.

## Modelos

- `GradeEditPermission`
  - `grantedBy` (Master/Admin), `grantedTo` (Control de Estudios), `schoolPeriodId` (nullable → global), `reason`, `expiresAt`, `revokedBy`, `revokedAt`, `active`.
- `GradeEditAudit`
  - `subjectFinalGradeId`, `permissionId`, `editedBy`, `oldValue`, `newValue`, `observation`, `createdAt`.

## Flujo

### 1. Otorgar permiso (Master/Admin)

- Página: `admin/GradeEditPermissions.tsx`.
- Endpoint: `POST /api/grade-edit-permissions`.
  ```json
  {
    "grantedTo": 12,
    "schoolPeriodId": null,       // null = global (todos los períodos)
    "reason": "Ajuste de notas período 2024-2025",
    "expiresAt": "2026-05-01"
  }
  ```
- Controller: `gradeEditPermissionController.createPermission`.
- Validaciones:
  - Usuario solicitante tiene rol Master o Administrador.
  - Usuario destinatario tiene rol Control de Estudios.
  - No existe un permiso activo duplicado para la misma combinación.

### 2. Listar / auditar

- `GET /api/grade-edit-permissions` – lista (filtros por usuario, período, estado).
- `GET /api/grade-edit-permissions/audit` – log completo de auditoría.

### 3. Verificar permiso (Control de Estudios)

- `GET /api/grade-edit-permissions/check/:schoolPeriodId` → boolean + detalle del permiso.
- El frontend (`FinalGradesEdit.tsx`) llama este endpoint al entrar y habilita/deshabilita la edición.

### 4. Editar nota

- Página: `control-estudios/FinalGradesEdit.tsx`.
- Service: `finalGradeEditService.ts`.
- Endpoint: `PUT /api/evaluation/final-grade/:id`
  - Body: `{ newValue, observation }`.
- Controller (`evaluationController.updateFinalGrade`):
  1. Busca `SubjectFinalGrade` por `id`.
  2. Verifica que el período está cerrado.
  3. Si está cerrado, llama a `gradeEditPermissionController` helper para validar permiso activo.
  4. Actualiza `SubjectFinalGrade.value`.
  5. Crea `GradeEditAudit` con `oldValue`, `newValue`, `editedBy`, `permissionId`.
  6. Todo dentro de `sequelize.transaction()`.

### 5. Revocar permiso (Master/Admin)

- `DELETE /api/grade-edit-permissions/:id` → marca `active=false`, `revokedBy`, `revokedAt`.
- No borra el registro (se conserva para historial).

## Reglas

- Un permiso puede ser:
  - **Global**: `schoolPeriodId = null` → aplica a cualquier período.
  - **Específico**: `schoolPeriodId = X` → solo para ese período.
- Un permiso expirado o revocado NO permite editar.
- Toda edición genera un registro en `GradeEditAudit`, incluso si el valor no cambia (para detectar intentos).

## Archivos clave

| Capa | Archivos |
|------|----------|
| Controllers | `gradeEditPermissionController.ts`, parte de `evaluationController.ts` (`updateFinalGrade`) |
| Rutas | `gradeEditPermissionRoutes.ts`, `evaluationRoutes.ts` |
| Modelos | `GradeEditPermission`, `GradeEditAudit`, `SubjectFinalGrade` |
| Frontend | `admin/GradeEditPermissions.tsx`, `control-estudios/FinalGradesEdit.tsx` |
| Frontend services | `gradeEditPermissionService.ts`, `finalGradeEditService.ts` |

## Roles permitidos

| Acción | Master | Admin | Control Estudios | Profesor |
|--------|--------|-------|------------------|----------|
| Otorgar permiso | ✅ | ✅ | ❌ | ❌ |
| Revocar permiso | ✅ | ✅ | ❌ | ❌ |
| Ver auditoría | ✅ | ✅ | ❌ | ❌ |
| Editar nota final (período cerrado) | — | — | ✅ (con permiso) | ❌ |
| Editar nota final (período activo) | Ver `grading.md` | | | |
