import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import { Inscription, Person, Role, Subject, PeriodGrade, InscriptionSubject, SchoolPeriod, Grade, Section, Contact, PersonRole, PersonResidence, StudentGuardian, Matriculation, GuardianProfile, StudentPreviousSchool, Plantel, EnrollmentAnswer, EnrollmentQuestion, EnrollmentDocument } from '../models';
import sequelize from '../config/database';
import { saveEnrollmentAnswers } from '@/services/enrollmentAnswerService';
import { GuardianDocumentType } from '@/models/GuardianProfile';
import { GuardianRelationship } from '@/models/StudentGuardian';
import { GuardianProfilePayload } from '@/services/guardianProfileService';
import { assignGuardians, GuardianAssignment } from '@/services/studentGuardianService';
import { EscolaridadStatus } from '@/types/enrollment';

const ESCOLARIDAD_VALUES: EscolaridadStatus[] = ['regular', 'repitiente', 'materia_pendiente'];
const normalizeEscolaridad = (value?: unknown): EscolaridadStatus => {
  if (typeof value !== 'string') return 'regular';
  const normalized = value.trim().toLowerCase() as EscolaridadStatus;
  if (ESCOLARIDAD_VALUES.includes(normalized)) {
    return normalized;
  }
  throw new Error('Valor de escolaridad inválido. Debe ser regular, repitiente o materia_pendiente.');
};

type GuardianInput = {
  firstName?: string;
  lastName?: string;
  documentType?: GuardianDocumentType;
  document?: string;
  residenceState?: string;
  residenceMunicipality?: string;
  residenceParish?: string;
  address?: string;
  phone?: string;
  email?: string;
  occupation?: string;
  birthdate?: string; // Expecting string (YYYY-MM-DD) from body
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
      birthdate,
      escolaridad
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
      status: 'pending',
      escolaridad: normalizeEscolaridad(escolaridad)
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
  'documentType',
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

  if (!required) {
    const hasIdentity = !isEmptyValue(data?.firstName) || !isEmptyValue(data?.lastName) || !isEmptyValue(data?.document);
    if (!hasIdentity) {
      return null;
    }
  }

  const missingFields = guardianRequiredFields.filter((field) => isEmptyValue(data?.[field]));
  if (missingFields.length > 0) {
    throw new Error(`Faltan campos obligatorios para ${label}: ${missingFields.join(', ')}`);
  }

  return data as CompleteGuardianInput;
};

const mapToGuardianProfilePayload = (data: CompleteGuardianInput): GuardianProfilePayload => ({
  firstName: data.firstName,
  lastName: data.lastName,
  documentType: data.documentType,
  document: data.document,
  phone: data.phone,
  email: data.email,
  residenceState: data.residenceState,
  residenceMunicipality: data.residenceMunicipality,
  residenceParish: data.residenceParish,
  address: data.address,
  occupation: data.occupation,
  birthdate: data.birthdate ? new Date(data.birthdate) : null
});

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
          required: hasStudentFilter,
          include: [
            { model: Contact, as: 'contact' },
            { model: PersonResidence, as: 'residence' },
            {
              model: StudentGuardian,
              as: 'guardians',
              include: [{ model: GuardianProfile, as: 'profile' }]
            },
            { model: StudentPreviousSchool, as: 'previousSchools' },
            {
              model: EnrollmentAnswer,
              as: 'enrollmentAnswers',
              include: [{ model: EnrollmentQuestion, as: 'question' }]
            }
          ]
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
            { model: StudentGuardian, as: 'guardians' },
            { model: StudentPreviousSchool, as: 'previousSchools' }
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
      previousSchoolIds,
      gradeId,
      sectionId,
      schoolPeriodId,
      mother,
      father,
      representative,
      representativeType,
      enrollmentAnswers,
      escolaridad,
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

    // Previous Schools
    if (Array.isArray(previousSchoolIds)) {
      // 1. Clear old
      await StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
      // 2. Map and add new
      const schoolRecords = [];
      for (const item of previousSchoolIds) {
        // Find plantel to get details
        const plantel = await Plantel.findOne({
          where: {
            [Op.or]: [{ code: item }, { name: item }]
          },
          transaction: t
        });

        schoolRecords.push({
          personId: person.id,
          plantelCode: plantel?.code || (typeof item === 'string' ? item : null),
          plantelName: plantel?.name || (typeof item === 'string' ? item : 'Desconocido'),
          state: plantel?.state || null,
          dependency: plantel?.dependency || null
        });
      }
      if (schoolRecords.length > 0) {
        await StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
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
    const assignments: GuardianAssignment[] = [];
    if (motherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(motherData),
        relationship: 'mother',
        isRepresentative: motherIsRepresentative
      });
    }
    if (fatherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(fatherData),
        relationship: 'father',
        isRepresentative: fatherIsRepresentative
      });
    }
    if (representativeData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(representativeData),
        relationship: 'representative',
        isRepresentative: true
      });
    }
    if (assignments.length > 0) {
      await assignGuardians(person.id, assignments, t);
    }

    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    const targetPeriodId = schoolPeriodId || matriculation.schoolPeriodId;
    const targetGradeId = gradeId || matriculation.gradeId;
    const targetSectionId = sectionId ?? matriculation.sectionId ?? null;
    const rawGroupSubjectIds = Array.isArray(req.body.subjectIds) ? req.body.subjectIds : [];
    const selectedGroupSubjectIds = Array.from(new Set(
      rawGroupSubjectIds
        .map((subjectId: number | string) => Number(subjectId))
        .filter((subjectId: number) => Number.isFinite(subjectId))
    ));

    const escolaridadValue = normalizeEscolaridad(escolaridad ?? matriculation.escolaridad);

    const existingInscription = await Inscription.findOne({
      where: { schoolPeriodId: targetPeriodId, personId: person.id },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (existingInscription) {
      await t.rollback();
      return res.status(400).json({ error: 'El estudiante ya está inscrito en este periodo escolar' });
    }

    matriculation.escolaridad = escolaridadValue;
    await matriculation.save({ transaction: t });

    const inscription = await Inscription.create({
      schoolPeriodId: targetPeriodId,
      gradeId: targetGradeId,
      sectionId: targetSectionId,
      personId: person.id,
      escolaridad: escolaridadValue
    }, { transaction: t });

    const periodGrade = await PeriodGrade.findOne({
      where: { schoolPeriodId: targetPeriodId, gradeId: targetGradeId },
      include: [{ model: Subject, as: 'subjects' }],
      transaction: t
    });

    if (periodGrade?.subjects?.length) {
      console.log(`[Enrollment] Processing ${periodGrade.subjects.length} subjects for grade ${targetGradeId}`);

      // 1. Core subjects (no group)
      const coreSubjects = periodGrade.subjects
        .filter((s: any) => !s.subjectGroupId)
        .map((s: any) => ({
          inscriptionId: inscription.id,
          subjectId: s.id
        }));

      // 2. Selected group subjects
      const groupSubjects = periodGrade.subjects
        .filter((s: any) => s.subjectGroupId && selectedGroupSubjectIds.includes(s.id))
        .map((s: any) => ({
          inscriptionId: inscription.id,
          subjectId: s.id
        }));

      const subjectsToAdd = [...coreSubjects, ...groupSubjects];

      console.log(`[Enrollment] Enrolling in ${subjectsToAdd.length} subjects (${coreSubjects.length} core, ${groupSubjects.length} group)`);

      if (subjectsToAdd.length > 0) {
        await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
      }
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
    const { schoolPeriodId, gradeId, sectionId, q, gender, escolaridad } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;
    if (escolaridad) where.escolaridad = escolaridad;

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
          required: hasPersonFilter, // Force INNER JOIN if filtering by person
          include: [
            { model: Contact, as: 'contact' },
            { model: PersonResidence, as: 'residence' },
            {
              model: StudentGuardian,
              as: 'guardians',
              include: [{ model: GuardianProfile, as: 'profile' }]
            },
            {
              model: EnrollmentAnswer,
              as: 'enrollmentAnswers',
              include: [{ model: EnrollmentQuestion, as: 'question' }]
            }
          ]
        },
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: Subject, as: 'subjects', through: { attributes: [] } },
        { model: Matriculation, as: 'matriculation' }
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
    const { schoolPeriodId, gradeId, personId, sectionId, enrollmentAnswers, escolaridad, documents } = req.body;

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

    // 3. Create Matriculation (PENDING)
    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(personId, enrollmentAnswers, { transaction: t });
    }

    const matriculation = await Matriculation.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId,
      status: 'pending',
      escolaridad: normalizeEscolaridad(escolaridad)
    }, { transaction: t });

    // Documents
    if (documents) {
      await EnrollmentDocument.create({
        matriculationId: matriculation.id,
        ...documents
      }, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      message: 'Solicitud de inscripción registrada exitosamente',
      matriculation
    });


  } catch (error: any) {
    await t.rollback();
    res.status(500).json({ error: 'Error al inscribir', details: error.message || error });
  }
};

export const updateInscription = async (req: Request, res: Response) => {
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
      previousSchoolIds,
      gradeId,
      sectionId,
      mother,
      father,
      representative,
      representativeType,
      enrollmentAnswers,
      escolaridad,
      subjectIds,
    } = req.body;

    console.log('[updateInscription] ID:', id);
    console.log('[updateInscription] Body recibido:', JSON.stringify(req.body, null, 2));

    const inscription = await Inscription.findByPk(id, {
      include: [{ model: Person, as: 'student' }],
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!inscription) {
      await t.rollback();
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }

    const person = inscription.student;
    if (!person) {
      await t.rollback();
      return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
    }

    console.log('[updateInscription] Person antes de actualizar:', {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName
    });

    // Update Person Data if provided
    if (firstName) person.firstName = firstName;
    if (lastName) person.lastName = lastName;
    if (documentType) person.documentType = documentType;
    if (document !== undefined) person.document = document || null;
    if (gender) person.gender = gender;
    if (birthdate) person.birthdate = birthdate;

    console.log('[updateInscription] Person después de cambios (antes de save):', {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName
    });

    await person.save({ transaction: t });

    console.log('[updateInscription] Person guardado en BD');

    // Contact
    if (phone1 || phone2 || email || address || whatsapp) {
      const contactPayload: any = { personId: person.id };
      if (phone1 !== undefined) contactPayload.phone1 = phone1;
      if (phone2 !== undefined) contactPayload.phone2 = phone2;
      if (email !== undefined) contactPayload.email = email;
      if (address !== undefined) contactPayload.address = address;
      if (whatsapp !== undefined) contactPayload.whatsapp = whatsapp;

      const existingContact = await Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (existingContact) {
        await existingContact.update(contactPayload, { transaction: t });
      } else {
        await Contact.create(contactPayload, { transaction: t });
      }
    }

    // Residence
    if (birthState || birthMunicipality || birthParish || residenceState || residenceMunicipality || residenceParish) {
      const residencePayload: any = { personId: person.id };
      if (birthState) residencePayload.birthState = birthState;
      if (birthMunicipality) residencePayload.birthMunicipality = birthMunicipality;
      if (birthParish) residencePayload.birthParish = birthParish;
      if (residenceState) residencePayload.residenceState = residenceState;
      if (residenceMunicipality) residencePayload.residenceMunicipality = residenceMunicipality;
      if (residenceParish) residencePayload.residenceParish = residenceParish;

      const existingResidence = await PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (existingResidence) {
        await existingResidence.update(residencePayload, { transaction: t });
      } else {
        await PersonResidence.create(residencePayload, { transaction: t });
      }
    }

    // Previous Schools
    if (Array.isArray(previousSchoolIds)) {
      await StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
      const schoolRecords = [];
      for (const item of previousSchoolIds) {
        const plantel = await Plantel.findOne({
          where: {
            [Op.or]: [{ code: item }, { name: item }]
          },
          transaction: t
        });
        schoolRecords.push({
          personId: person.id,
          plantelCode: plantel?.code || (typeof item === 'string' ? item : null),
          plantelName: plantel?.name || (typeof item === 'string' ? item : 'Desconocido'),
          state: plantel?.state || null,
          dependency: plantel?.dependency || null
        });
      }
      if (schoolRecords.length > 0) {
        await StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
      }
    }

    // Guardians
    const assignments: GuardianAssignment[] = [];

    if (mother && hasGuardianData(mother)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(mother as CompleteGuardianInput),
        relationship: 'mother',
        isRepresentative: representativeType === 'mother'
      });
    }
    if (father && hasGuardianData(father)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(father as CompleteGuardianInput),
        relationship: 'father',
        isRepresentative: representativeType === 'father'
      });
    }
    if (representative && hasGuardianData(representative)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(representative as CompleteGuardianInput),
        relationship: 'representative',
        isRepresentative: true
      });
    }

    if (assignments.length > 0) {
      await assignGuardians(person.id, assignments, t);
    }

    // Enrollment Answers
    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    // Escolaridad
    if (escolaridad !== undefined) {
      inscription.escolaridad = normalizeEscolaridad(escolaridad);
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
        console.log(`[UpdateInscription] Processing ${periodGrade.subjects.length} subjects for new grade ${gradeId}`);
        // Filter out subjects that belong to a group
        const subjectsToAdd = periodGrade.subjects
          .filter((s: any) => {
            const hasGroup = s.subjectGroupId !== null && s.subjectGroupId !== undefined;
            if (hasGroup) {
              console.log(`[UpdateInscription] Skipping subject ${s.name} (ID: ${s.id}) because it belongs to group ${s.subjectGroupId}`);
            }
            return !hasGroup;
          })
          .map((s: any) => ({
            inscriptionId: inscription.id,
            subjectId: s.id
          }));

        console.log(`[UpdateInscription] Enrolling in ${subjectsToAdd.length} subjects`);

        if (subjectsToAdd.length > 0) {
          await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
        }
      }
    }

    // Handle group subject updates (when subjectIds is provided)
    if (Array.isArray(subjectIds)) {
      console.log(`[UpdateInscription] Updating group subjects:`, subjectIds);

      // Get all subjects for this grade to identify which are group subjects
      const periodGrade = await PeriodGrade.findOne({
        where: {
          schoolPeriodId: inscription.schoolPeriodId,
          gradeId: inscription.gradeId
        },
        include: [{ model: Subject, as: 'subjects' }],
        transaction: t
      });

      if (periodGrade && periodGrade.subjects) {
        const allGroupSubjectIds = periodGrade.subjects
          .filter((s: any) => s.subjectGroupId !== null && s.subjectGroupId !== undefined)
          .map((s: any) => s.id);

        // Remove all existing group subjects for this inscription
        if (allGroupSubjectIds.length > 0) {
          await InscriptionSubject.destroy({
            where: {
              inscriptionId: id,
              subjectId: { [Op.in]: allGroupSubjectIds }
            },
            transaction: t
          });
          console.log(`[UpdateInscription] Removed old group subjects`);
        }

        // Add new group subjects
        if (subjectIds.length > 0) {
          const newGroupSubjects = subjectIds.map((subjectId: number) => ({
            inscriptionId: inscription.id,
            subjectId: subjectId
          }));
          await InscriptionSubject.bulkCreate(newGroupSubjects, { transaction: t });
          console.log(`[UpdateInscription] Added ${subjectIds.length} new group subjects`);
        }
      }
    }

    await t.commit();
    res.json({ message: 'Datos actualizados correctamente', inscription });
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
      pathology,
      livingWith,
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
      previousSchoolIds,
      // Enrollment data
      schoolPeriodId,
      gradeId,
      sectionId,
      enrollmentAnswers,
      escolaridad,
      documents
    } = req.body;

    // 0. Auto-generate document if Cedula Escolar and empty
    let finalDocument = document;
    if (documentType === 'Cedula Escolar' && (!document || document.trim() === '')) {
      if (!mother || !mother.document) {
        throw new Error('La cédula de la madre es obligatoria para generar la Cédula Escolar.');
      }

      // 1. Nationality Char
      const nationalityChar = req.body.nationality === 'Extranjero' ? 'E' : 'V';

      // 2. Birth Order
      let birthOrder = 1;
      const motherProfile = await GuardianProfile.findOne({
        where: { document: mother.document },
        transaction: t
      });
      if (motherProfile) {
        const childrenCount = await StudentGuardian.count({
          where: { guardianId: motherProfile.id, relationship: 'mother' },
          transaction: t
        });
        birthOrder = childrenCount + 1;
      }

      // 3. Year of birth (last 2 digits)
      const birthYear = birthdate ? new Date(birthdate).getFullYear().toString().slice(-2) : '00';

      // 4. Construct: [N][Order][Year][MotherID]
      finalDocument = `${nationalityChar}${birthOrder}${birthYear}${mother.document}`;
    }

    // 1. Create Person (no User)
    const person = await Person.create({
      firstName,
      lastName,
      documentType,
      document: finalDocument,
      gender,
      birthdate,
      pathology,
      livingWith,
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
        phone1: phone1 || '',
        phone2: phone2 || null,
        email: email || null,
        address: address || '',
        whatsapp: whatsapp || null,
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
      residenceParish,
      address
    }, { transaction: t });

    // 3.5. Previous Schools
    if (Array.isArray(previousSchoolIds)) {
      const schoolRecords = [];
      for (const item of previousSchoolIds) {
        const plantel = await Plantel.findOne({
          where: { [Op.or]: [{ code: item }, { name: item }] },
          transaction: t
        });
        schoolRecords.push({
          personId: person.id,
          plantelCode: plantel?.code || (typeof item === 'string' ? item : null),
          plantelName: plantel?.name || (typeof item === 'string' ? item : 'Desconocido'),
          state: plantel?.state || null,
          dependency: plantel?.dependency || null
        });
      }
      if (schoolRecords.length > 0) {
        await StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
      }
    }

    // 4. Create guardians
    const assignments: GuardianAssignment[] = [];

    if (motherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(motherData),
        relationship: 'mother',
        isRepresentative: motherIsRepresentative
      });
    }

    if (fatherData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(fatherData),
        relationship: 'father',
        isRepresentative: fatherIsRepresentative
      });
    }

    if (representativeData) {
      assignments.push({
        payload: mapToGuardianProfilePayload(representativeData),
        relationship: 'representative',
        isRepresentative: true
      });
    }

    if (!assignments.some((guardian) => guardian.isRepresentative)) {
      throw new Error('Debe seleccionar al menos un representante legal.');
    }

    if (assignments.length > 0) {
      await assignGuardians(person.id, assignments, t);
    }

    // 4. Assign Alumno role
    let role = await Role.findOne({ where: { name: 'Alumno' }, transaction: t });
    if (!role) {
      role = await Role.create({ name: 'Alumno' }, { transaction: t });
    }
    await PersonRole.create({ personId: person.id, roleId: role.id }, { transaction: t });

    // 5. Create Matriculation (PENDING)
    const escolaridadValue = normalizeEscolaridad(escolaridad);

    const matriculation = await Matriculation.create({
      schoolPeriodId,
      gradeId,
      sectionId: sectionId || null,
      personId: person.id,
      status: 'pending',
      escolaridad: escolaridadValue
    }, { transaction: t });

    // 6. Enrollment Answers (moved here to be consistent)
    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    // 7. Enrollment Documents
    if (documents) {
      await EnrollmentDocument.create({
        matriculationId: matriculation.id,
        ...documents
      }, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      message: 'Solicitud de inscripción registrada exitosamente',
      person,
      matriculation
    });
  } catch (error: any) {
    await t.rollback();
    console.error(error);
    res.status(500).json({ error: 'Error al registrar e inscribir', details: error.message || error });
  }
};

export const updateMatriculation = async (req: Request, res: Response) => {
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
      previousSchoolIds,
      gradeId,
      sectionId,
      mother,
      father,
      representative,
      representativeType,
      enrollmentAnswers,
      escolaridad,
      pathology,
      livingWith,
      documents
    } = req.body;

    console.log('[updateMatriculation] ID:', id);
    console.log('[updateMatriculation] Body recibido:', JSON.stringify(req.body, null, 2));

    const matriculation = (await Matriculation.findByPk(id, {
      include: [
        { model: Person, as: 'student' },
        { model: Inscription, as: 'inscription' }
      ],
      transaction: t,
      lock: t.LOCK.UPDATE
    })) as MatriculationWithStudent | null;

    if (!matriculation) {
      await t.rollback();
      return res.status(404).json({ error: 'Matriculación no encontrada' });
    }

    const person = matriculation.student;
    if (!person) {
      await t.rollback();
      return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
    }

    console.log('[updateMatriculation] Person antes de actualizar:', {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName
    });

    // Update Person Data if provided
    if (firstName) person.firstName = firstName;
    if (lastName) person.lastName = lastName;
    if (documentType) person.documentType = documentType;
    if (document !== undefined) person.document = document || null;
    if (gender) person.gender = gender;
    if (birthdate) person.birthdate = birthdate;
    if (pathology !== undefined) person.pathology = pathology;
    if (livingWith !== undefined) person.livingWith = livingWith;

    console.log('[updateMatriculation] Person después de cambios (antes de save):', {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName
    });

    await person.save({ transaction: t });

    console.log('[updateMatriculation] Person guardado en BD');

    // Contact
    if (phone1 || phone2 || email || address || whatsapp) {
      const contactPayload: any = { personId: person.id };
      if (phone1 !== undefined) contactPayload.phone1 = phone1;
      if (phone2 !== undefined) contactPayload.phone2 = phone2;
      if (email !== undefined) contactPayload.email = email;
      if (address !== undefined) contactPayload.address = address;
      if (whatsapp !== undefined) contactPayload.whatsapp = whatsapp;

      const existingContact = await Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (existingContact) {
        await existingContact.update(contactPayload, { transaction: t });
      } else {
        await Contact.create(contactPayload, { transaction: t });
      }
    }

    // Residence
    if (birthState || birthMunicipality || birthParish || residenceState || residenceMunicipality || residenceParish) {
      const residencePayload: any = { personId: person.id };
      if (birthState) residencePayload.birthState = birthState;
      if (birthMunicipality) residencePayload.birthMunicipality = birthMunicipality;
      if (birthParish) residencePayload.birthParish = birthParish;
      if (residenceState) residencePayload.residenceState = residenceState;
      if (residenceMunicipality) residencePayload.residenceMunicipality = residenceMunicipality;
      if (residenceParish) residencePayload.residenceParish = residenceParish;
      if (address) residencePayload.address = address;

      const existingResidence = await PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
      if (existingResidence) {
        await existingResidence.update(residencePayload, { transaction: t });
      } else {
        await PersonResidence.create(residencePayload, { transaction: t });
      }
    }

    // Previous Schools
    if (Array.isArray(previousSchoolIds)) {
      await StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
      const schoolRecords = [];
      for (const item of previousSchoolIds) {
        const plantel = await Plantel.findOne({
          where: {
            [Op.or]: [{ code: item }, { name: item }]
          },
          transaction: t
        });
        schoolRecords.push({
          personId: person.id,
          plantelCode: plantel?.code || (typeof item === 'string' ? item : null),
          plantelName: plantel?.name || (typeof item === 'string' ? item : 'Desconocido'),
          state: plantel?.state || null,
          dependency: plantel?.dependency || null
        });
      }
      if (schoolRecords.length > 0) {
        await StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
      }
    }

    // Guardians - Simplified for partial updates
    const assignments: GuardianAssignment[] = [];

    if (mother && hasGuardianData(mother)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(mother as CompleteGuardianInput),
        relationship: 'mother',
        isRepresentative: representativeType === 'mother'
      });
    }
    if (father && hasGuardianData(father)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(father as CompleteGuardianInput),
        relationship: 'father',
        isRepresentative: representativeType === 'father'
      });
    }
    if (representative && hasGuardianData(representative)) {
      assignments.push({
        payload: mapToGuardianProfilePayload(representative as CompleteGuardianInput),
        relationship: 'representative',
        isRepresentative: true
      });
    }

    if (assignments.length > 0) {
      await assignGuardians(person.id, assignments, t);
    }

    // Enrollment Answers
    if (Array.isArray(enrollmentAnswers)) {
      await saveEnrollmentAnswers(person.id, enrollmentAnswers, { transaction: t });
    }

    // Grade, Section, Escolaridad
    if (escolaridad !== undefined) {
      const escolaridadValue = normalizeEscolaridad(escolaridad);
      matriculation.escolaridad = escolaridadValue;
      if (matriculation.inscription) {
        matriculation.inscription.escolaridad = escolaridadValue;
        await matriculation.inscription.save({ transaction: t });
      }
    }

    if (gradeId !== undefined) matriculation.gradeId = gradeId;
    if (sectionId !== undefined) matriculation.sectionId = sectionId;

    await matriculation.save({ transaction: t });

    // Sync Inscription if it exists (completed status)
    if (matriculation.status === 'completed' && matriculation.inscription) {
      const inscription = matriculation.inscription;
      const oldGradeId = inscription.gradeId;

      if (gradeId !== undefined) inscription.gradeId = gradeId;
      if (sectionId !== undefined) inscription.sectionId = sectionId;

      await inscription.save({ transaction: t });

      // If grade changed, sync subjects
      if (gradeId !== undefined && Number(gradeId) !== Number(oldGradeId)) {
        await InscriptionSubject.destroy({
          where: { inscriptionId: inscription.id },
          transaction: t
        });

        const periodGrade = await PeriodGrade.findOne({
          where: {
            schoolPeriodId: inscription.schoolPeriodId,
            gradeId: gradeId
          },
          include: [{ model: Subject, as: 'subjects' }],
          transaction: t
        });

        if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
          const subjectsToAdd = periodGrade.subjects
            .filter((s: any) => !s.subjectGroupId)
            .map((s: any) => ({
              inscriptionId: inscription.id,
              subjectId: s.id
            }));

          if (subjectsToAdd.length > 0) {
            await InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
          }
        }
      }
    }

    // Documents
    if (documents) {
      const docRecord = await EnrollmentDocument.findOne({ where: { matriculationId: matriculation.id }, transaction: t });
      if (docRecord) {
        await docRecord.update(documents, { transaction: t });
      } else {
        await EnrollmentDocument.create({ matriculationId: matriculation.id, ...documents }, { transaction: t });
      }
    }

    await t.commit();
    res.json({ message: 'Datos actualizados correctamente', matriculation });

  } catch (error: any) {
    if (t) await t.rollback();
    console.error('Error updating matriculation:', error);
    res.status(500).json({ error: 'Error actualizando datos', details: error.message || error });
  }
};
