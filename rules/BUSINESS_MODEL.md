# 🏫 Modelo de Negocio — BatallaProject (School Management System)

> **Propósito**: Este documento explica el modelo de negocio del sistema escolar para que cualquier agente de IA entienda QUÉ hace el sistema, POR QUÉ y CÓMO, independientemente del código.  
> **Audiencia**: Agentes de IA, nuevos desarrolladores, o cualquier persona que necesite entender la lógica de negocio.

---

## 1. ¿Qué es BatallaProject?

Es un **Sistema de Gestión Escolar** para instituciones educativas venezolanas. Administra todo el ciclo de vida académico de un estudiante:

```
Matrícula → Inscripción → Evaluación → Consejo de Curso → Cierre de Período → Promoción
```

El sistema soporta **6 roles de usuario** con permisos diferenciados, múltiples períodos escolares simultáneos, y un sistema de auditoría para edición de notas.

---

## 2. Entidades principales del negocio

### 2.1 Personas y usuarios

- **Person**: Todo actor del sistema es primero una Persona (nombre, documento, fecha de nacimiento, etc.).
- **User**: Una persona puede tener o no una cuenta de acceso. Un estudiante inscrito no necesita cuenta.
- **Roles**: Una persona puede tener múltiples roles simultáneamente (ej: un profesor que también es representante).
- **GuardianProfile**: Perfil reutilizable de representante legal. Un mismo tutor puede representar a varios estudiantes sin duplicar datos.

### 2.2 Estructura académica

```
Período Escolar (SchoolPeriod)
  └── Grado (Grade) ← vinculados vía PeriodGrade
       ├── Sección A, B, C... (Section) ← vía PeriodGradeSection
       └── Materia 1, 2, 3... (Subject) ← vía PeriodGradeSubject (con orden)
            └── Lapsos (Term): 1er, 2do, 3er lapso

Cada PeriodGradeSubject puede tener un profesor asignado (TeacherAssignment) por sección.
```

**Conceptos clave**:
- Un **Período Escolar** = un año académico (ej: "2025-2026").
- Un **Grado** = nivel educativo (ej: "1er Año", "5to Año").
- Una **Sección** = grupo dentro del grado (ej: "A", "B").
- Un **Lapso (Term)** = subdivisión temporal del período (ej: 1er, 2do, 3er lapso).
- Las **Especialidades (Specialization)** son menciones opcionales (ej: "Ciencias").
- Los **SubjectGroups** agrupan materias electivas — el estudiante elige una del grupo.

### 2.3 Inscripción y matrícula

**Matrícula ≠ Inscripción:**

| Concepto | Significa | Estado típico |
|----------|-----------|---------------|
| **Matriculation** (Matrícula) | Pre-solicitud del estudiante. Incluye documentos, preguntas, datos del representante. | `pending` → `enrolled` |
| **Inscription** (Inscripción) | Registro formal del estudiante en un período+grado+sección específico. | Activa |

**Flujo normal**: Matrícula → Aprobación → Inscripción → Asignación de materias automática.

**Vías de inscripción**:
1. **Estándar**: Wizard paso a paso (datos personales → documentos → representante → confirmar).
2. **Rápida**: Formulario mínimo para casos urgentes.
3. **Masiva por Excel**: Plantilla descargable → validación fila por fila → procesamiento en lote.

### 2.4 Representantes (Guardians)

- Un estudiante tiene un **representante** que es su contacto legal.
- Los representantes se almacenan en `GuardianProfile` (catálogo reutilizable por documento de identidad).
- La relación estudiante↔representante vive en `StudentGuardian` con tipo: `mother`, `father`, o `representative`.
- Un representante puede cambiar; al hacerlo, el anterior se *demote* (si era padre/madre) o se *destruye* (si era representante genérico).

---

## 3. Ciclo de evaluación

### 3.1 Plan de evaluación

El **Profesor** crea un plan de evaluación para cada materia que tiene asignada:
```
Materia X + Lapso 1:
  ├── Evaluación 1: "Prueba escrita" — 30%
  ├── Evaluación 2: "Trabajo práctico" — 40%
  └── Evaluación 3: "Quiz" — 30%
```
La suma de porcentajes por lapso debe ser 100%.

### 3.2 Calificaciones

El profesor registra notas por estudiante para cada ítem del plan:
```
Estudiante A → Prueba escrita: 15, Trabajo: 18, Quiz: 12
Estudiante B → Prueba escrita: 10, Trabajo: 14, Quiz: 16
```

### 3.3 Consejo de curso

Es una reunión donde los profesores y Control de Estudios revisan el rendimiento de cada estudiante. El sistema permite:
- Ver notas agregadas por grado/sección/lapso.
- Proponer ajustes de nota (`CouncilPoint`).
- Marcar el consejo como completado (`CouncilChecklist`).

### 3.4 Nota final

La nota final por materia (`SubjectFinalGrade`) se calcula combinando:
- Calificaciones de los ítems del plan.
- Puntos del consejo de curso (si aplica).
- Política de cálculo configurada.

**Redondeo**: ≥ 0.5 sube al entero, < 0.5 se mantiene. Máximo 1 decimal visible.

---

## 4. Cierre de período y promoción

### 4.1 Pre-requisitos del cierre

Antes de cerrar un período escolar:
- ✅ Todos los estudiantes tienen notas completas.
- ✅ Todos los consejos de curso están registrados.
- ✅ No hay notas pendientes sin resolver.

### 4.2 Proceso de cierre

1. **Validación**: El sistema verifica que todo esté completo.
2. **Preview**: Se muestra una simulación de resultados (aprobados, reprobados, con pendientes) **sin persistir nada**.
3. **Ejecución** (transaccional):
   - Se calcula y congela la `SubjectFinalGrade` de cada materia por estudiante.
   - Se genera el `StudentPeriodOutcome` (resultado del estudiante).
   - Para materias reprobadas: se crea un `PendingSubject`.
   - Se desactiva el período si aplica.

### 4.3 Reglas de promoción

| Resultado | Destino |
|-----------|---------|
| Aprobado en todas las materias | **Promovido** al grado siguiente (según `SchoolPeriodTransitionRule`) |
| Reprobado en ≤ N materias (configurable) | **Promovido con pendientes** (PendingSubject) |
| Reprobado en > N materias | **Repitiente** en el mismo grado |

Las materias pendientes se arrastran al siguiente período y aparecen al final de la lista de materias del estudiante.

---

## 5. Edición de notas post-cierre

Una vez cerrado el período, las notas finales están **congeladas**. Para editarlas:

1. **Master o Administrador** otorga un `GradeEditPermission` a un usuario de `Control de Estudios` (puede ser global o por período, con fecha de vencimiento).
2. **Control de Estudios** edita la nota, lo cual genera un `GradeEditAudit` automático (valor anterior, nuevo, quién, cuándo, motivo).
3. El permiso puede ser **revocado** en cualquier momento.

---

## 6. Reportes (parcialmente implementados)

### Implementados
- Listados de inscritos/matriculados con filtros.
- Exportación a Excel.
- Reporte PDF de matrícula (Puppeteer).

### Pendientes
- Boletín de calificaciones oficial.
- Notas certificadas.
- Resumen de calificaciones por período.
- Estadísticas de rendimiento.

---

## 7. Datos específicos de Venezuela

- **Documentos**: Cédula venezolana como identificador primario.
- **Ubicación**: Jerarquía Estado → Municipio → Parroquia (catálogo en `backend/src/assets/venezuela.json`).
- **Planteles**: Instituciones educativas registradas (con datos del ministerio).
- Escalas de calificación estándar.

---

## 8. Mapa de roles y permisos (resumen ejecutivo)

```
Master ─── Acceso total. Configura todo.
  │
  ├── Administrador ─── Inscribir estudiantes, gestionar personal, planteles, permisos de notas.
  │     │
  │     └── Control de Estudios ─── Matricular, consejos de curso, editar notas (con permiso).
  │
  ├── Profesor ─── Plan de evaluación, registrar notas de sus materias.
  │
  ├── Representante ─── Ver expediente de sus representados.
  │
  └── Alumno ─── Ver su propio expediente.
```

---

## 9. Glosario

| Término (español) | Término técnico | Significado |
|--------------------|----------------|-------------|
| Período escolar | SchoolPeriod | Año académico |
| Grado | Grade | Nivel educativo |
| Sección | Section | Grupo dentro del grado |
| Lapso | Term | Subdivisión temporal (trimestre) |
| Materia | Subject | Asignatura |
| Matrícula | Matriculation | Pre-inscripción/solicitud |
| Inscripción | Inscription | Registro formal del estudiante |
| Plan de evaluación | EvaluationPlan | Estructura de evaluaciones con porcentajes |
| Calificación | Qualification | Nota de un estudiante en una evaluación |
| Nota final | SubjectFinalGrade | Nota consolidada por materia |
| Consejo de curso | CouncilPoint/Checklist | Reunión de revisión académica |
| Cierre de período | PeriodClosure | Proceso de cierre y promoción |
| Materia pendiente | PendingSubject | Materia reprobada arrastrada al siguiente período |
| Representante | GuardianProfile | Padre/madre/tutor legal |
| Plantel | Plantel | Institución educativa |
| Mención | Specialization | Especialidad académica |

---

## 10. Referencia cruzada con el código

Para detalles técnicos de implementación, consultar:
- **Flujos detallados**: `docs/flows/*.md`
- **Modelos y DB**: `docs/database-models.md`
- **API REST**: `docs/backend-api.md`
- **Roles**: `docs/roles-permissions.md`
- **Convenciones**: `docs/conventions.md`
