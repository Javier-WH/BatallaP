# AGENTS.md – `backend/src/models`

> Modelos Sequelize. Un archivo por modelo. **Todas** las asociaciones viven en `index.ts`.
> Para el modelo de datos completo: [`docs/database-models.md`](../../../docs/database-models.md).

## ⚠️ Reglas críticas

1. **NUNCA** definir asociaciones dentro del archivo del modelo. Siempre en `index.ts`.
2. Al añadir un modelo nuevo:
   - Crear el archivo `ModelName.ts` con `Model.init(...)`.
   - Importar y re-exportar en `index.ts`.
   - Definir sus asociaciones en la sección temática correspondiente de `index.ts`.
   - Actualizar [`docs/database-models.md`](../../../docs/database-models.md).
3. El orden de imports en `index.ts` importa (modelos dependientes después de sus padres) – respetarlo.
4. Las asociaciones usan `as: 'alias'` siempre. El alias es parte del contrato con los controllers.
5. `sequelize.sync({ force: true })` (desarrollo) recrea todo desde los modelos.

## Grupos temáticos

| Grupo | Modelos |
|-------|---------|
| **Personas** | `User`, `Person`, `Role`, `PersonRole`, `Contact`, `PersonResidence`, `StudentPreviousSchool` |
| **Representantes** | `GuardianProfile`, `StudentGuardian` |
| **Estructura académica** | `SchoolPeriod` (con flag `isExternal` para períodos de instituciones externas), `Grade`, `Section`, `Subject`, `SubjectGroup`, `Specialization`, `PeriodGrade`, `PeriodGradeSection`, `PeriodGradeSubject`, `Term`, `SchoolPeriodTransitionRule`, `Plantel` |
| **Inscripción** | `Matriculation`, `EnrollmentDocument`, `EnrollmentQuestion`, `EnrollmentAnswer`, `EnrollmentReport`, `Inscription`, `InscriptionSubject` |
| **Evaluación** | `EvaluationPlan`, `Qualification`, `SubjectFinalGrade`, `CouncilPoint`, `CouncilChecklist`, `TeacherAssignment` |
| **Cierre de período** | `PeriodClosure`, `StudentPeriodOutcome`, `PendingSubject` |
| **Edición de notas** | `GradeEditPermission`, `GradeEditAudit` |
| **Misceláneo** | `Setting`, `DashboardContent` |

## Constraints importantes

- `StudentGuardian`: UNIQUE(`studentId`, `relationship`). Ver `docs/flows/enrollment.md` sección "Manejo de representantes".
- `PeriodGradeSection` / `PeriodGradeSubject`: PKs compuestas.
- `GuardianProfile`: UNIQUE(`documentType`, `document`).

## Aliases clave (no renombrar sin coordinación)

- `Person → contact`, `residence`, `guardians` (StudentGuardian), `inscriptions`, `roles`, `previousSchools`, `teachingAssignments`, `enrollmentAnswers`, `matriculations`.
- `Inscription → student` (Person), `period` (SchoolPeriod), `grade`, `section`, `subjects` (Subject via InscriptionSubject), `inscriptionSubjects`, `matriculation`, `periodOutcome`, `pendingSubjects`.
- `InscriptionSubject → inscription`, `subject`, `qualifications`, `finalGrade` (SubjectFinalGrade), `councilPoints`.
- `SubjectFinalGrade → inscriptionSubject`, `plantel`, `editAudits`.
- `GradeEditPermission → granter`, `recipient`, `revoker`, `schoolPeriod`, `audits`.
- `GradeEditAudit → subjectFinalGrade`, `permission`, `editor`.

## Qué hacer si un controller no encuentra una asociación

1. Verifica que esté definida en `index.ts`.
2. Importa el modelo desde `@/models` (no desde el archivo directo).
3. En el `findAll({ include: [...] })` usa exactamente el mismo `as` que en `index.ts`.
