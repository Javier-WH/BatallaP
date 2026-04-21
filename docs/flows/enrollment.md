# 📋 Flujo: Matriculación e inscripción de estudiantes

## Diferencia conceptual

| Entidad | Significado |
|---------|-------------|
| **Matriculation** | Solicitud/preinscripción del estudiante al siguiente período. Incluye documentos y preguntas de inscripción. Puede quedar en borrador. |
| **Inscription** | Inscripción formal: el estudiante ya forma parte del `SchoolPeriod` + `Grade` + `Section` y tiene `InscriptionSubject` por materia. |

El flujo típico es **Matriculation → Inscription**. También existe una vía directa (quick-register) para administradores.

---

## Flujo 1: Matricular → Inscribir (estándar)

### 1. Crear / actualizar matrícula

- Página: `control-estudios/MatriculationEnrollment.tsx` (wizard multi-paso).
- Endpoints:
  - `POST /api/inscriptions/` o `POST /api/inscriptions/register`
  - Upload de documentos via `POST /api/upload/documents`
  - Guardar respuestas de preguntas: `POST /api/enrollment-answers/:personId`
  - Asignar representantes: `GET /api/guardians/search` + guardado en update de usuario.
- Modelos tocados: `Person`, `Contact`, `PersonResidence`, `StudentPreviousSchool`, `GuardianProfile`, `StudentGuardian`, `Matriculation`, `EnrollmentDocument`, `EnrollmentAnswer`.

### 2. Confirmar inscripción

- `POST /api/matriculations/:id/enroll` → crea `Inscription` + `InscriptionSubject[]` a partir de la matrícula.
- Service: `studentEnrollmentService.ts`.
- Filtro: las materias que pertenecen a un `SubjectGroup` NO se asignan automáticamente (el estudiante elige en modal posterior).

### 3. Gestionar materias de grupo

- Página: `admin/StudentSubjectsModal.tsx`.
- Endpoints:
  - `POST /api/inscriptions/:id/subjects` para agregar.
  - `DELETE /api/inscriptions/:id/subjects/:subjectId` para remover.

### 4. Reporte PDF

- `POST /api/enrollment-reports/generate/:matriculationId` produce PDF con Puppeteer.
- Descarga posterior con `GET /api/enrollment-reports/:uuid`.

---

## Flujo 2: Inscripción rápida (Admin)

- Página: `admin/QuickEnrollStudent.tsx`.
- Endpoint: `POST /api/inscriptions/quick-register`.
- Crea Persona + Contacto mínimos + `Inscription` en un paso. Útil para migraciones o casos urgentes.

---

## Flujo 3: Inscripción estándar con wizard

- Página: `admin/EnrollStudent.tsx`.
- Endpoint principal: `POST /api/inscriptions/register` (Persona + Inscripción en una transacción).
- No crea User (el estudiante inicialmente no necesita cuenta).

---

## Flujo 4: Carga masiva por Excel

### Paso 1: Descargar plantilla

- `GET /api/inscriptions/bulk/template` → Excel generado por `bulkEnrollmentService.ts` (ExcelJS).
- Incluye selectores dropdown con catálogos: Estados/Municipios/Parroquias de Venezuela, planteles, grados, secciones, subject groups.
- Prellena datos del estudiante (solo residencia por defecto: Guárico / Monagas / Altagracia de Orituco).

### Paso 2: Preview

- `POST /api/inscriptions/bulk/preview` (multipart `file`).
- Service valida cada fila: tipos, documentos no duplicados, referencias válidas, dependencias padre/madre/representante.
- Retorna lista con estado por fila: `ok`, `warning`, `error`.

### Paso 3: Procesar

- `POST /api/inscriptions/bulk/process` → ejecuta inscripciones en lote dentro de transacción.
- Errores por fila no abortan el resto.

### Paso 4: Reintentar fila fallida

- `POST /api/inscriptions/bulk/retry-single` con los datos corregidos.
- UI: `components/BulkRetryModal.tsx`.

---

## Manejo de representantes

- Los representantes viven en `GuardianProfile` (catálogo reutilizable, identificado por documento).
- `StudentGuardian` vincula estudiante ↔ profile con `relationship` ∈ `{mother, father, representative}` y flag `isRepresentative`.
- Al asignar un nuevo representante:
  - Si la relación anterior era `mother`/`father`, se **demote** (isRepresentative=false) — no se borra.
  - Si era `representative` pura, se **destroy** — evita violar UNIQUE(studentId, relationship).
- Referencia del fix: ver historial en `AGENTS.md` sección "Historial de Contexto".
- Frontend: `SearchGuardianModal.tsx` busca por documento; si no existe, `findOrCreateGuardianProfile` crea el perfil y devuelve su ID correcto (no confundir con `Person.id`).

## Archivos clave

| Capa | Archivos |
|------|----------|
| Backend controllers | `inscriptionController.ts`, `bulkEnrollmentController.ts`, `guardianController.ts`, `enrollmentReportController.ts`, `enrollmentAnswerController.ts`, `enrollmentQuestionController.ts` |
| Backend services | `studentEnrollmentService.ts`, `studentGuardianService.ts`, `guardianProfileService.ts`, `bulkEnrollmentService.ts`, `enrollmentAnswerService.ts`, `enrollmentReportService.ts`, `plantelCatalog.ts` |
| Backend modelos | `Matriculation`, `Inscription`, `InscriptionSubject`, `EnrollmentDocument`, `EnrollmentQuestion`, `EnrollmentAnswer`, `EnrollmentReport`, `GuardianProfile`, `StudentGuardian`, `StudentPreviousSchool` |
| Frontend pages | `admin/EnrollStudent.tsx`, `admin/QuickEnrollStudent.tsx`, `control-estudios/MatriculationEnrollment.tsx`, `admin/StudentSubjectsModal.tsx` |
| Frontend services | `bulkEnrollment.ts`, `guardians.ts`, `enrollmentQuestions.ts`, `enrollmentReportService.ts` |
| Frontend components | `shared/SearchGuardianModal.tsx`, `BulkRetryModal.tsx`, `EnrollmentQuestionFields.tsx` |
