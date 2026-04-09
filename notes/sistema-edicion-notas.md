# Sistema de Edición de Notas - Documentación de Cambios

**Fecha:** Abril 2026  
**Propósito:** Sistema para permitir la modificación de notas finales de estudiantes en períodos escolares anteriores, con control de permisos y auditoría completa.

---

## 📋 Resumen del Sistema

El sistema permite que usuarios con rol "Control de Estudios" modifiquen notas finales de períodos escolares inactivos (anteriores), siempre y cuando tengan un permiso explícito otorgado por usuarios Master o Administrador. Todas las modificaciones quedan registradas en un log de auditoría para rastrear cualquier fraude.

---

## 🏗️ Arquitectura del Sistema

### Backend

#### 1. Modelos de Datos

**Archivo:** `backend/src/models/GradeEditPermission.ts`
- Representa un permiso para editar notas
- Campos:
  - `id`: Identificador único
  - `schoolPeriodId`: ID del período escolar (opcional para permiso global)
  - `grantedBy`: ID del usuario que otorgó el permiso
  - `grantedTo`: ID del usuario que recibe el permiso
  - `actCode`: Código del acta que autoriza el permiso
  - `observations`: Observaciones adicionales
  - `isActive`: Estado del permiso (activo/revocado)
  - `grantedAt`: Fecha de otorgamiento
  - `revokedAt`: Fecha de revocación (opcional)
  - `revokedBy`: ID del usuario que revocó (opcional)

**Archivo:** `backend/src/models/GradeEditAudit.ts`
- Registra cada modificación de nota
- Campos:
  - `id`: Identificador único
  - `subjectFinalGradeId`: ID de la nota final modificada
  - `editedBy`: ID del usuario que modificó
  - `permissionId`: ID del permiso utilizado
  - `previousScore`: Nota anterior
  - `newScore`: Nueva nota
  - `previousStatus`: Estado anterior
  - `newStatus`: Nuevo estado
  - `reason`: Razón de la modificación
  - `editedAt`: Fecha de modificación

**Archivo:** `backend/src/models/index.ts`
- Agregadas asociaciones:
  - `GradeEditPermission` ↔ `SchoolPeriod` (BelongsTo)
  - `GradeEditPermission` ↔ `User` (as granter y recipient)
  - `GradeEditPermission` ↔ `SubjectFinalGrade` (hasMany)
  - `GradeEditAudit` ↔ `SubjectFinalGrade` (BelongsTo)
  - `GradeEditAudit` ↔ `User` (as editor)
  - `GradeEditAudit` ↔ `GradeEditPermission` (BelongsTo)

#### 2. Migración de Base de Datos

**Archivo:** `backend/src/migrations/20260409120000-create-grade-edit-permissions.ts`
- Crea tabla `grade_edit_permissions` con índices
- Crea tabla `grade_edit_audits` con índices
- Establece claves foráneas hacia:
  - `school_periods`
  - `users` (granter y recipient)
  - `subject_final_grades`
- Agrega índices para optimizar búsquedas

#### 3. Controller

**Archivo:** `backend/src/controllers/gradeEditPermissionController.ts`

**Funciones:**
- `createPermission`: Crea un nuevo permiso de edición
  - Solo Master y Administrador
  - Puede ser global (todos los períodos) o específico por período
  - Requiere código de acta y observaciones

- `getPermissions`: Lista todos los permisos
  - Solo Master y Administrador
  - Incluye relaciones con usuarios y períodos

- `revokePermission`: Revoca un permiso existente
  - Solo Master y Administrador
  - Marca como inactivo y registra quién revocó

- `checkPermission`: Verifica si un usuario tiene permiso
  - Para Control de Estudios
  - Verifica permiso global o específico por período

- `getAuditLog`: Obtiene el historial de modificaciones
  - Solo Master y Administrador
  - Paginable
  - Incluye todas las relaciones

#### 4. Rutas API

**Archivo:** `backend/src/routes/gradeEditPermissionRoutes.ts`

**Endpoints:**
- `POST /api/grade-edit-permissions` - Crear permiso
- `GET /api/grade-edit-permissions` - Listar permisos
- `DELETE /api/grade-edit-permissions/:id` - Revocar permiso
- `GET /api/grade-edit-permissions/check/:userId/:schoolPeriodId` - Verificar permiso
- `GET /api/grade-edit-permissions/audit` - Obtener log de auditoría

#### 5. Modificación a Evaluation Controller

**Archivo:** `backend/src/controllers/evaluationController.ts`

**Nueva función:** `updateFinalGrade`
- Endpoint: `PUT /api/evaluation/final-grade/:id`
- Verifica:
  - Usuario tiene rol "Control de Estudios"
  - Usuario tiene permiso activo para el período
  - El período escolar está inactivo (`isActive: false`)
- Modifica:
  - Nota final (`finalScore`)
  - Estado (`status`)
- Crea entrada en `GradeEditAudit` con:
  - Valores anteriores y nuevos
  - Razón de la modificación
  - Permiso utilizado
- Todo dentro de una transacción para atomicidad

#### 6. Configuración de App

**Archivo:** `backend/src/app.ts`
- Agregada importación de `gradeEditPermissionRoutes`
- Registrada ruta en `/api/grade-edit-permissions`

---

### Frontend

#### 1. Servicio API

**Archivo:** `frontend/src/services/gradeEditPermissionService.ts`

**Interfaces TypeScript:**
```typescript
interface GradeEditPermission {
  id: number;
  schoolPeriodId?: number | null;
  schoolPeriod?: {
    id: number;
    name: string;
    period: string;
  };
  grantedBy: number;
  granter?: {
    id: number;
    person?: { firstName: string; lastName: string };
  };
  grantedTo: number;
  recipient?: {
    id: number;
    person?: { firstName: string; lastName: string };
  };
  actCode: string;
  observations: string;
  isActive: boolean;
  grantedAt: string;
  revokedAt?: string | null;
}

interface GradeEditAudit {
  id: number;
  subjectFinalGradeId: number;
  subjectFinalGrade?: {
    inscriptionSubject?: {
      inscription?: {
        student?: { firstName: string; lastName: string };
        period?: { name: string };
      };
      subject?: { name: string };
    };
  };
  editedBy: number;
  editor?: {
    person?: { firstName: string; lastName: string };
  };
  permissionId: number;
  permission?: GradeEditPermission;
  previousScore: number;
  newScore: number;
  previousStatus: string;
  newStatus: string;
  reason: string;
  editedAt: string;
}
```

**Funciones:**
- `createPermission(data)` - Crear nuevo permiso
- `getPermissions()` - Listar todos los permisos
- `revokePermission(id)` - Revocar permiso
- `checkPermission(userId, schoolPeriodId)` - Verificar permiso
- `getAuditLog(params)` - Obtener log de auditoría
- `updateFinalGrade(id, data)` - Modificar nota final

#### 2. Componente de Administración

**Archivo:** `frontend/src/pages/admin/GradeEditPermissions.tsx`

**Características:**
- Layout con tabs:
  - Tab 1: "Permisos Activos" - Tabla de permisos vigentes
  - Tab 2: "Historial de Auditoría" - Log de todas las modificaciones

**Funcionalidades:**
- Botón para crear nuevo permiso (solo Master/Admin)
- Modal con formulario para crear permiso:
  - Selección de usuario (Control de Estudios)
  - Selección de período escolar (opcional para global)
  - Código de acta (requerido)
  - Observaciones (requerido)
- Tabla de permisos con:
  - Información del período (o "Todos los períodos")
  - Usuario que otorgó
  - Usuario que recibió
  - Código de acta
  - Observaciones
  - Estado (activo/revocado)
  - Fecha
  - Acción: Revocar permiso (si está activo)
- Tabla de auditoría con:
  - Fecha de modificación
  - Estudiante
  - Materia
  - Período
  - Nota anterior y nueva (con visualización de cambio)
  - Estado anterior y nuevo
  - Usuario que modificó
  - Razón

**Componentes UI:**
- Ant Design: Table, Modal, Form, Tabs, Tag, Button, Popconfirm
- Iconos: LockOutlined, DeleteOutlined, CheckCircleOutlined, etc.

#### 3. Integración en Rutas

**Archivo:** `frontend/src/App.tsx`
- Agregada importación de `GradeEditPermissions`
- Agregada ruta: `/admin/permisos-edicion-notas`
- Protegida para roles Master y Administrador

#### 4. Sidebar

**Archivo:** `frontend/src/pages/MainLayout.tsx`
- Agregado ícono `LockOutlined`
- Agregado item de menú: "Permisos Edición Notas"
- Visible para roles Master y Administrador
- Ruta: `/admin/permisos-edicion-notas`

---

## 🔐 Flujo de Trabajo

### 1. Otorgar Permiso (Master/Admin)
1. Navegar a `/admin/permisos-edicion-notas`
2. Hacer clic en "Crear Permiso"
3. Completar formulario:
   - Seleccionar usuario de Control de Estudios
   - Seleccionar período (opcional)
   - Ingresar código de acta
   - Ingresar observaciones
4. Confirmar creación
5. El permiso aparece en la tabla de permisos activos

### 2. Modificar Nota (Control de Estudios)
1. Usuario de Control de Estudios debe tener permiso activo
2. Endpoint `PUT /api/evaluation/final-grade/:id`
3. Backend verifica:
   - Rol del usuario
   - Permiso activo para el período
   - Período está inactivo
4. Si válido:
   - Modifica nota final
   - Crea entrada en auditoría
5. Si no válido:
   - Retorna error 403

### 3. Revocar Permiso (Master/Admin)
1. En tabla de permisos activos
2. Hacer clic en "Revocar" junto al permiso
3. Confirmar acción
4. Permiso marcado como inactivo
5. Usuario ya no puede modificar notas

### 4. Ver Auditoría (Master/Admin)
1. Navegar a tab "Historial de Auditoría"
2. Ver todas las modificaciones realizadas
3. Cada entrada incluye:
   - Quién modificó
   - Qué nota cambió
   - Valores anteriores y nuevos
   - Razón
   - Fecha

---

## 🗄️ Base de Datos

### Tablas Creadas

**grade_edit_permissions:**
```sql
CREATE TABLE grade_edit_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  school_period_id INT NULL,
  granted_by INT NOT NULL,
  granted_to INT NOT NULL,
  act_code VARCHAR(50) NOT NULL,
  observations TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  granted_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoked_by INT NULL,
  FOREIGN KEY (school_period_id) REFERENCES school_periods(id),
  FOREIGN KEY (granted_by) REFERENCES users(id),
  FOREIGN KEY (granted_to) REFERENCES users(id),
  FOREIGN KEY (revoked_by) REFERENCES users(id),
  INDEX idx_school_period (school_period_id),
  INDEX idx_granted_to (granted_to),
  INDEX idx_is_active (is_active)
);
```

**grade_edit_audits:**
```sql
CREATE TABLE grade_edit_audits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  subject_final_grade_id INT NOT NULL,
  edited_by INT NOT NULL,
  permission_id INT NOT NULL,
  previous_score DECIMAL(5,2),
  new_score DECIMAL(5,2),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  reason TEXT,
  edited_at DATETIME NOT NULL,
  FOREIGN KEY (subject_final_grade_id) REFERENCES subject_final_grades(id),
  FOREIGN KEY (edited_by) REFERENCES users(id),
  FOREIGN KEY (permission_id) REFERENCES grade_edit_permissions(id),
  INDEX idx_subject_final_grade (subject_final_grade_id),
  INDEX idx_edited_by (edited_by),
  INDEX idx_edited_at (edited_at)
);
```

---

## 🔄 Sistema de Migración Automática

**Archivo:** `backend/src/config/migrationRunner.ts`

**Características:**
- Ejecuta migraciones automáticamente al iniciar el servidor
- Detecta migraciones pendientes en `src/migrations/`
- Crea tabla `SequelizeMeta` para rastrear ejecuciones
- Maneja bases de datos con tablas existentes (de `sync()`)
- Captura errores de duplicados y marca como ejecutadas
- Usa `import()` dinámico para módulos ES6/TypeScript

**Integración:**
- `backend/src/server.ts` ejecuta `migrationRunner.runMigrations()` antes de iniciar el servidor

---

## 📝 Actualización de Documentación

**Archivo:** `AGENTS.md`
- Agregados modelos `GradeEditPermission` y `GradeEditAudit`
- Actualizada tabla de roles con permisos de edición de notas
- Agregada funcionalidad en "Implementadas"
- Actualizado historial de contexto

---

## ✅ Requisitos Cumplidos

1. ✅ Solo usuarios Master/Admin pueden otorgar permisos
2. ✅ Permisos pueden ser globales o específicos por período
3. ✅ Solo Control de Estudios puede modificar notas con permiso activo
4. ✅ Solo períodos inactivos pueden ser modificados
5. ✅ Auditoría completa de todas las modificaciones
6. ✅ Registro de quién otorgó el permiso (código de acta)
7. ✅ Permisos pueden ser revocados
8. ✅ Sistema de migración automática para futuras tablas

---

## 🚀 Próximos Pasos (Opcionales)

- Crear componente frontend para Control de Estudios para modificar notas
- Agregar notificaciones cuando se otorga/revoca un permiso
- Crear reportes de auditoría exportables
- Agregar validaciones adicionales (ej. límite de modificaciones por período)
