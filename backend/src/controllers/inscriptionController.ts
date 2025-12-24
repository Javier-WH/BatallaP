import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Inscription, Person, Role, Subject, PeriodGrade, InscriptionSubject, SchoolPeriod, Grade, Section, Contact, PersonRole, PersonResidence, StudentGuardian, Matriculation } from '../models';
import sequelize from '../config/database';
import { saveEnrollmentAnswers } from '@/services/enrollmentAnswerService';

type GuardianInput = {
  firstName?: string;
  lastName?: string;
  document?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  phone?: string;
  email?: string;
};

export const quickRegister = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const {
      schoolPeriodId,
      gradeId,
      sectionId,
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate
    } = req.body;

    if (!gradeId) {
      await t.rollback();
      return res.status(400).json({ error: 'El grado es obligatorio' });
    }

    const targetPeriodId = schoolPeriodId
      ? schoolPeriodId
      : (
        await SchoolPeriod.findOne({
          where: { isActive: true },
          attributes: ['id'],
          transaction: t
        })
      )?.id;

    if (!targetPeriodId) {
      await t.rollback();
      return res.status(400).json({ error: 'No se encontró un periodo escolar activo' });
    }

    if (!firstName || !lastName || !documentType || !document || !gender || !birthdate) {
      await t.rollback();
      return res.status(400).json({ error: 'Datos básicos del estudiante incompletos' });
    }

    const person = await Person.create({
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      userId: null
    }, { transaction: t });

    let studentRole = await Role.findOne({ where: { name: 'Alumno' }, transaction: t });
    if (!studentRole) {
      studentRole = await Role.create({ name: 'Alumno' }, { transaction: t });
    }
    await PersonRole.create({ personId: person.id, roleId: studentRole.id }, { transaction: t });

    const matriculation = await Matriculation.create({
      personId: person.id,
      schoolPeriodId: targetPeriodId,
      gradeId,
      sectionId: sectionId || null,
      status: 'pending'
    }, { transaction: t });

    await t.commit();
    res.status(201).json({
      message: 'Estudiante matriculado exitosamente',
      person,
      matriculation
    });
  } catch (error: any) {
    if (t) await t.rollback();
    console.error('Error en quickRegister:', error);
    res.status(500).json({ error: 'Error al matricular estudiante', details: error.message || error });
  }
};

type CompleteGuardianInput = Required<GuardianInput>;

const guardianRequiredFields: (keyof GuardianInput)[] = [
  'firstName',
  'lastName',
  'document',
  'residenceState',
  'residenceMunicipality',
  'residenceParish',
  'address',
  'phone',
  'email'
];

const isEmptyValue = (value: unknown) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
};

const hasGuardianData = (data?: GuardianInput | null) => {
  if (!data) return false;
  return Object.values(data).some((value) => !isEmptyValue(value));
};

const validateGuardianPayload = (
  label: string,
  data: GuardianInput | null | undefined,
  required: boolean
): CompleteGuardianInput | null => {
  const hasData = hasGuardianData(data);

  if (!hasData) {
    if (required) {
      throw new Error(`Los datos de ${label} son obligatorios.`);
    }
    return null;
  }

  const missingFields = guardianRequiredFields.filter((field) => isEmptyValue(data?.[field]));
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos obligatorios para ${label}: ${missingFields.join(', ')}`);
  }

  return data as CompleteGuardianInput;
};

export const getMatriculations = async (req: Request, res: Response) => {
  try {
    const { status = 'pending', schoolPeriodId, gradeId, sectionId, q } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;

    const studentWhere: any = {};
    let hasStudentFilter = false;
    if (q) {
      const like = `%${q}%`;
      studentWhere[Op.or] = [
        { firstName: { [Op.like]: like } },
        { lastName: { [Op.like]: like } },
        { document: { [Op.like]: like } }
      ];
      hasStudentFilter = true;
    }

    const matriculations = await Matriculation.findAll({
      where,
      include: [
        {
          model: Person,
          as: 'student',
          where: hasStudentFilter ? studentWhere : undefined,
          required: hasStudentFilter
        },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(matriculations);
  } catch (error) {
    console.error('Error fetching matriculations:', error);
    res.status(500).json({ error: 'Error obteniendo matriculados' });
  }
};

export const getMatriculationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const matriculation = await Matriculation.findByPk(id, {
      include: [
        {
          model: Person,
          as: 'student',
          include: [
            { model: Contact, as: 'contact' },
            { model: PersonResidence, as: 'residence' },
            { model: StudentGuardian, as: 'guardians' }
          ]
        },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Inscription, as: 'inscription' }
      ]
    });

    if (!matriculation) {
      return res.status(404).json({ error: 'Matriculación no encontrada' });
    }

    res.json(matriculation);
  } catch (error) {
    console.error('Error fetching matriculation:', error);
    res.status(500).json({ error: 'Error obteniendo la matriculación' });
  }
};

type MatriculationWithStudent = Matriculation & { student?: Person | null };

export const enrollMatriculatedStudent = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish,
      address,
      phone1,
      phone2,
      email,
      whatsapp,
      gradeId,
      sectionId,
      schoolPeriodId,
      mother,
      father,
      representative,
      representativeType,
      enrollmentAnswers
    } = req.body;

    const matriculation = (await Matriculation.findByPk(id, {
      include: [{ model: Person, as: 'student' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    })) as MatriculationWithStudent | null;

    if (!matriculation) {
      await t.rollback();
      return res.status(404).json({ error: 'Matriculación no encontrada' });
    }

    if (matriculation.status === 'completed') {
      await t.rollback();
      return res.status(400).json({ error: 'El estudiante ya fue inscrito' });
    }

    const person = matriculation.student;
    if (!person) {
      await t.rollback();
      return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
    }

    if (!firstName || !lastName || !documentType || !gender || !birthdate) {
      await t.rollback();
      return res.status(400).json({ error: 'Datos básicos del estudiante incompletos' });
    }

    person.firstName = firstName;
    person.lastName = lastName;
    person.documentType = documentType;
    person.document = document || null;
    person.gender = gender;
    person.birthdate = birthdate;
    await person.save({ transaction: t });

    // Contact
    if (phone1 || phone2 || email || address || whatsapp) {
      const contactPayload = { phone1, phone2, email, address, whatsapp, personId: person.id };
      const existingContact = await Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (existingContact) {
        await existingContact.update(contactPayload, { transaction: t });
      } else {
        await Contact.create(contactPayload, { transaction: t });
      }
    }

    // Residence
    if (!birthState || !birthMunicipality || !birthParish || !residenceState || !residenceMunicipality || !residenceParish) {
      await t.rollback();
      return res.status(400).json({ error: 'Datos de nacimiento y residencia son obligatorios.' });
    }

    const residencePayload = {
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish,
      personId: person.id
    };
    const existingResidence = await PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
    if (existingResidence) {
      await existingResidence.update(residencePayload, { transaction: t });
    } else {
      await PersonResidence.create(residencePayload, { transaction: t });
    }

    // Guardians
    const representativeSelection = typeof representativeType === 'string' && ['mother', 'father', 'other'].includes(representativeType)
      ? representativeType
      : 'mother';
    const motherIsRepresentative = representativeSelection === 'mother';
    const fatherIsRepresentative = representativeSelection === 'father';
    const representativeDataRequired = representativeSelection === 'other' || (!motherIsRepresentative && !fatherIsRepresentative);
    const motherDataRequired = motherIsRepresentative || documentType === 'Cedula Escolar';
    const fatherDataRequired = fatherIsRepresentative;

    const motherData = validateGuardianPayload('la madre', mother, motherDataRequired);
    const fatherData = validateGuardianPayload('el padre', father, fatherDataRequired);
    const representativeData = validateGuardianPayload('el representante', representative, representativeDataRequired);

    if (!motherIsRepresentative && !fatherIsRepresentative && !representativeData) {
      throw new Error('Debe registrar un representante si la madre o el padre no lo son.');
    }

    await StudentGuardian.destroy({ where: { studentId: person.id }, transaction: t });

    const guardiansToCreate = [];
    if (motherData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'mother' as const,
        isRepresentative: motherIsRepresentative,
        ...motherData
      });
    }
    if (fatherData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'father' as const,
        isRepresentative: fatherIsRepresentative,
        ...fatherData
      });
    }
    if (representativeData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'representative' as const,
        isRepresentative: true,
        ...representativeData
      });
    }
    if (guardiansToCreate.length > 0) {
      await StudentGuardian.bulkCreate(guardiansToCreate, { transaction: t });
    }

    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    const targetPeriodId = schoolPeriodId || matriculation.schoolPeriodId;
    const targetGradeId = gradeId || matriculation.gradeId;
    const targetSectionId = sectionId ?? matriculation.sectionId ?? null;

    const existingInscription = await Inscription.findOne({
      where: { schoolPeriodId: targetPeriodId, personId: person.id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (existingInscription) {
      await t.rollback();
      return res.status(400).json({ error: 'El estudiante ya está inscrito en este periodo escolar' });
    }

    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    const inscription = await Inscription.create({
      schoolPeriodId: targetPeriodId,
      gradeId: targetGradeId,
      sectionId: targetSectionId,
      personId: person.id
    }, { transaction: t });

    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId: targetPeriodId, gradeId: targetGradeId },
      include: [{ model: Subject, as: 'subjects' }],
      transaction: t
    });

    if (periodGrade?.subjects?.length) {
      const subjectsToAdd = periodGrade.subjects.map((s: any) => ({
        inscriptionId: inscription.id,
        subjectId: s.id
      }));
      await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
    }

    matriculation.gradeId = targetGradeId;
    matriculation.sectionId = targetSectionId;
    matriculation.schoolPeriodId = targetPeriodId;
    matriculation.status = 'completed';
    matriculation.inscriptionId = inscription.id;
    await matriculation.save({ transaction: t });

    await t.commit();
    const result = await Matriculation.findByPk(id, {
      include: [
        { model: Person, as: 'student' },
        { model: Inscription, as: 'inscription' }
      ]
    });
    res.status(201).json({
      message: 'Estudiante inscrito exitosamente',
      matriculation: result
    });
  } catch (error: any) {
    if (t) await t.rollback();
    console.error('Error al inscribir matriculado:', error);
    res.status(500).json({ error: 'Error al inscribir estudiante matriculado', details: error.message || error });
  }
};

export const getInscriptions = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId, q, gender } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;

    const personWhere: any = {};
    let hasPersonFilter = false;

    if (gender) {
      personWhere.gender = gender;
      hasPersonFilter = true;
    }

    // Search by name, last name or document
    if (q) {
      personWhere[Op.or] = [
        { firstName: { [Op.like]: `%${q}%` } },
        { lastName: { [Op.like]: `%${q}%` } },
        { document: { [Op.like]: `%${q}%` } }
      ];
      hasPersonFilter = true;
    }

    const inscriptions = await Inscription.findAll({
      where,
      include: [
        {
          model: Person,
          as: 'student',
          where: hasPersonFilter ? personWhere : undefined,
          required: hasPersonFilter // Force INNER JOIN if filtering by person
        },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Subject, as: 'subjects', through: { attributes: [] } }
      ],
      order: [['createdAt', 'DESC']]
    });
    res.json(inscriptions);
  } catch (error) {
    console.error('Error en getInscriptions:', error);
    res.status(500).json({ error: 'Error obteniendo inscripciones' });
  }
};

export const getInscriptionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const inscription = await Inscription.findByPk(id, {
      include: [
        { model: Person, as: 'student' },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Subject, as: 'subjects', through: { attributes: [] } }
      ]
    });
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });
    res.json(inscription);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo inscripción', details: error });
  }
};

export const createInscription = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { schoolPeriodId, gradeId, personId, sectionId, enrollmentAnswers } = req.body;

    // 1. Verify Role Student
    const person = await Person.findByPk(personId, {
      include: [{ model: Role, as: 'roles' }]
    });

    if (!person) {
      await t.rollback();
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    // Check if user has 'student' role (case insensitive)
    const isStudent = person.roles?.some((r: any) =>
      r.name.toLowerCase() === 'student' ||
      r.name.toLowerCase() === 'estudiante' ||
      r.name.toLowerCase() === 'alumno'
    );

    if (!isStudent) {
      await t.rollback();
      return res.status(400).json({ error: 'La persona seleccionada no tiene el rol de estudiante' });
    }

    // 2. Check existence (student can only be enrolled once per period)
    const existing = await Inscription.findOne({
      where: { schoolPeriodId, personId },
      transaction: t
    });

    if (existing) {
      await t.rollback();
      return res.status(400).json({ error: 'El estudiante ya está inscrito en este periodo escolar' });
    }

    // 3. Create Inscription
    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(personId, enrollmentAnswers, { transaction: t });
    }

    const inscription = await Inscription.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId
    }, { transaction: t });

    // 4. Auto-assign subjects from PeriodGrade structure
    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId, gradeId },
      include: [{ model: Subject, as: 'subjects' }],
      transaction: t
    });

    if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
      const subjectsToAdd = periodGrade.subjects.map((s: any) => ({
        inscriptionId: inscription.id,
        subjectId: s.id
      }));

      await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
    }

    await t.commit();

    // Refetch to return full data
    const result = await Inscription.findByPk(inscription.id, {
      include: [{ model: Subject, as: 'subjects' }]
    });

    res.status(201).json(result);
  } catch (error: any) {
    await t.rollback();
    res.status(500).json({ error: 'Error al inscribir', details: error.message || error });
  }
};

export const updateInscription = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { sectionId, gradeId } = req.body;

    const inscription = await Inscription.findByPk(id, { transaction: t });
    if (!inscription) {
      await t.rollback();
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    const oldGradeId = inscription.gradeId;

    // Update basic fields
    if (gradeId !== undefined) inscription.gradeId = gradeId;
    if (sectionId !== undefined) inscription.sectionId = sectionId;

    await inscription.save({ transaction: t });

    // If grade changed, we MUST sync subjects
    if (gradeId !== undefined && Number(gradeId) !== Number(oldGradeId)) {
      // 1. Remove old subjects
      await InscriptionSubject.destroy({
        where: { inscriptionId: id },
        transaction: t
      });

      // 2. Add subjects from the NEW grade structure
      const periodGrade = await PeriodGrade.findOne({
        where: {
          schoolPeriodId: inscription.schoolPeriodId,
          gradeId: gradeId
        },
        include: [{ model: Subject, as: 'subjects' }],
        transaction: t
      });

      if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
        const subjectsToAdd = periodGrade.subjects.map((s: any) => ({
          inscriptionId: inscription.id,
          subjectId: s.id
        }));
        await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
      }
    }

    await t.commit();
    res.json(inscription);
  } catch (error: any) {
    if (t) await t.rollback();
    console.error('Error updating inscription:', error);
    res.status(500).json({ error: 'Error actualizando inscripción', details: error.message || error });
  }
};

export const deleteInscription = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const inscription = await Inscription.findByPk(id);
    if (!inscription) {
      await t.rollback();
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    // Remove subjects first (cascade might handle this, but explicit is safe)
    await InscriptionSubject.destroy({ where: { inscriptionId: id }, transaction: t });
    await inscription.destroy({ transaction: t });

    await t.commit();
    res.json({ message: 'Inscripción eliminada' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: 'Error eliminando inscripción', details: error });
  }
};

// Additional methods for manual subject management
export const addSubjectToInscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // inscription id
    const { subjectId } = req.body;

    const inscription = await Inscription.findByPk(id);
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });

    await InscriptionSubject.create({ inscriptionId: Number(id), subjectId });
    res.json({ message: 'Materia agregada a la inscripción' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error agregando materia', details: error.message });
  }
};

export const removeSubjectFromInscription = async (req: Request, res: Response) => {
  try {
    const { id, subjectId } = req.params; // inscription id, subject id

    const deleted = await InscriptionSubject.destroy({
      where: { inscriptionId: id, subjectId }
    });

    if (!deleted) return res.status(404).json({ error: 'Materia no encontrada en esta inscripción' });

    res.json({ message: 'Materia removida de la inscripción' });
  } catch (error: any) {
    res.status(500).json({ error: 'Error removiendo materia', details: error.message });
  }
};

// Register a new student (Person without User) and enroll them
export const registerAndEnroll = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const {
      // Person data
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish,
      mother,
      father,
      representative,
      representativeType,
      // Contact data
      phone1,
      phone2,
      email,
      address,
      whatsapp,
      // Enrollment data
      schoolPeriodId,
      gradeId,
      sectionId,
      enrollmentAnswers
    } = req.body;

    // 1. Create Person (no User)
    const person = await Person.create({
      firstName,
      lastName,
      documentType,
      document,
      gender,
      birthdate,
      userId: null // No user associated
    }, { transaction: t });

    // Validate residence payload
    const hasResidenceData = birthState && birthMunicipality && birthParish && residenceState && residenceMunicipality && residenceParish;
    if (!hasResidenceData) {
      throw new Error('Datos de nacimiento y residencia son obligatorios para registrar estudiantes.');
    }

    const representativeSelection = typeof representativeType === 'string' && ['mother', 'father', 'other'].includes(representativeType)
      ? representativeType
      : 'mother';
    const motherIsRepresentative = representativeSelection === 'mother';
    const fatherIsRepresentative = representativeSelection === 'father';
    const representativeDataRequired = representativeSelection === 'other' || (!motherIsRepresentative && !fatherIsRepresentative);
    const motherDataRequired = motherIsRepresentative || documentType === 'Cedula Escolar';
    const fatherDataRequired = fatherIsRepresentative;

    const motherData = validateGuardianPayload('la madre', mother, motherDataRequired);
    const fatherData = validateGuardianPayload('el padre', father, fatherDataRequired);
    const representativeData = validateGuardianPayload('el representante', representative, representativeDataRequired);

    if (!motherIsRepresentative && !fatherIsRepresentative && !representativeData) {
      throw new Error('Debe registrar un representante si la madre o el padre no lo son.');
    }

    // 2. Create Contact
    if (phone1 || email || address) {
      await Contact.create({
        phone1,
        phone2,
        email,
        address,
        whatsapp,
        personId: person.id
      }, { transaction: t });
    }

    // 3. Create Residence data
    await PersonResidence.create({
      personId: person.id,
      birthState,
      birthMunicipality,
      birthParish,
      residenceState,
      residenceMunicipality,
      residenceParish
    }, { transaction: t });

    // 4. Create guardians
    const guardiansToCreate = [];

    if (motherData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'mother' as const,
        isRepresentative: motherIsRepresentative,
        ...motherData
      });
    }

    if (fatherData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'father' as const,
        isRepresentative: fatherIsRepresentative,
        ...fatherData
      });
    }

    if (representativeData) {
      guardiansToCreate.push({
        studentId: person.id,
        relationship: 'representative' as const,
        isRepresentative: true,
        ...representativeData
      });
    }

    if (!guardiansToCreate.some((guardian) => guardian.isRepresentative)) {
      throw new Error('Debe seleccionar al menos un representante legal.');
    }

    if (guardiansToCreate.length > 0) {
      await StudentGuardian.bulkCreate(guardiansToCreate, { transaction: t });
    }

    // 4. Assign Alumno role
    let role = await Role.findOne({ where: { name: 'Alumno' }, transaction: t });
    if (!role) {
      role = await Role.create({ name: 'Alumno' }, { transaction: t });
    }
    await PersonRole.create({ personId: person.id, roleId: role.id }, { transaction: t });

    // 5. Create Inscription
    const inscription = await Inscription.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId: person.id
    }, { transaction: t });

    // 6. Auto-assign subjects from PeriodGrade structure
    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId, gradeId },
      include: [{ model: Subject, as: 'subjects' }],
      transaction: t
    });

    if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
      const subjectsToAdd = periodGrade.subjects.map((s: any) => ({
        inscriptionId: inscription.id,
        subjectId: s.id
      }));
      await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      message: 'Estudiante registrado e inscrito exitosamente',
      person,
      inscription
    });
  } catch (error: any) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al registrar e inscribir', details: error.message || error });
  }
};
