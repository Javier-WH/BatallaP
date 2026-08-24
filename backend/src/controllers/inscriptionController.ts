import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import { Inscription, Person, Role, Subject, PeriodGrade, InscriptionSubject, SchoolPeriod, Grade, Section, Contact, PersonRole, PersonResidence, StudentGuardian, Matriculation, GuardianProfile, StudentPreviousSchool, Plantel, EnrollmentAnswer, EnrollmentQuestion, EnrollmentDocument, Term, SubjectTermGrade, InscriptionGroupTermChoice, SubjectGroup } from '../models';
import { changeGroupSubjectFromTerm, setGroupSubjectForTerm as setGroupSubjectForTermSvc } from '@/services/groupSubjectChoiceService';
import {
  getSubjectOrderMapByGradeAndPeriod,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import sequelize from '../config/database';
import { saveEnrollmentAnswers } from '@/services/enrollmentAnswerService';
import { GuardianDocumentType } from '@/models/GuardianProfile';
import { GuardianRelationship } from '@/models/StudentGuardian';
import { GuardianProfilePayload } from '@/services/guardianProfileService';
import { assignGuardians, GuardianAssignment } from '@/services/studentGuardianService';
import { EscolaridadStatus } from '@/types/enrollment';
import { registerAndEnrollStudent } from '@/services/studentEnrollmentService';
import { generateEnrollmentReport } from '@/services/enrollmentReportService';

const ESCOLARIDAD_VALUES: EscolaridadStatus[] = ['regular', 'repitiente', 'materia_pendiente'];

type RepresentativeTypeResponse = 'mother' | 'father' | 'sibling' | 'grandparent' | 'uncle_aunt' | 'other';

const deriveRepresentativeType = (guardians: Array<{ relationship?: unknown; isRepresentative?: unknown }> = []): RepresentativeTypeResponse => {
  const assignment = guardians.find(g => g.isRepresentative === true || g.isRepresentative === 1);
  const relationship = String(assignment?.relationship ?? '').trim().toLowerCase();
  if (relationship === 'mother' || relationship === 'madre') return 'mother';
  if (relationship === 'father' || relationship === 'padre') return 'father';
  if (relationship === 'sibling' || relationship === 'hermano') return 'sibling';
  if (relationship === 'grandparent' || relationship === 'abuelo') return 'grandparent';
  if (relationship === 'uncle_aunt' || relationship === 'tio') return 'uncle_aunt';
  return 'other';
};

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
  phone2?: string;
  whatsapp?: string;
  email?: string;
  occupation?: string;
  birthdate?: string; // Expecting string (YYYY-MM-DD) from body
  id?: number;
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
          where: { status: 'activo' },
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
  id: data.id,
  firstName: data.firstName,
  lastName: data.lastName,
  documentType: data.documentType,
  document: data.document,
  phone: data.phone,
  phone2: data.phone2,
  whatsapp: data.whatsapp,
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
    const { status, schoolPeriodId, gradeId, sectionId, q } = req.query;

    const where: any = {};
    if (status) where.status = status; // Solo filtrar si se especifica
    // NO filtrar por schoolPeriodId por defecto - mostrar todos los períodos
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;

    // Hide hidden students from non-admin roles
    const userRoles: string[] = (req.session as any).user?.roles || [];
    const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
    if (!isPrivileged) {
      where.hiddenFromControlEstudios = false;
    }

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
        { model: Section, as: 'section' },
        { model: EnrollmentDocument, as: 'documents' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const result = matriculations.map(matriculation => {
      const json = matriculation.toJSON() as any;
      if (json.student) {
        json.student.representativeType = deriveRepresentativeType(json.student.guardians);
      }
      return json;
    });
    res.json(result);
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

    // Inherit phone from the representative if not explicitly provided.
    const repSource = representative || (representativeType === 'mother' ? mother : representativeType === 'father' ? father : null);
    const inheritedPhone = (repSource as any)?.phone || '';
    const inheritedWhatsapp = (repSource as any)?.whatsapp || (repSource as any)?.phone || '';
    const inheritedPhone2 = (repSource as any)?.phone2 || '';

    // Contact
    const finalPhone1 = phone1 || inheritedPhone;
    const finalWhatsapp = whatsapp || inheritedWhatsapp;
    const finalPhone2 = phone2 || inheritedPhone2;
    if (finalPhone1 || finalPhone2 || email || address || finalWhatsapp) {
      const contactPayload = { phone1: finalPhone1, phone2: finalPhone2, email, address, whatsapp: finalWhatsapp, personId: person.id };
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
    const validRepresentativeTypes = ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'];
    const representativeSelection = typeof representativeType === 'string' && validRepresentativeTypes.includes(representativeType)
      ? representativeType
      : 'mother';
    const motherIsRepresentative = representativeSelection === 'mother';
    const fatherIsRepresentative = representativeSelection === 'father';
    const representativeDataRequired = !motherIsRepresentative && !fatherIsRepresentative;
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
      include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
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

    let reportUuid: string | undefined;
    try {
      const report = await generateEnrollmentReport(matriculation.id, t);
      reportUuid = report.uuid;
    } catch (reportError) {
      console.warn('[enrollMatriculated] No se pudo generar reporte:', reportError);
    }

    await t.commit();
    const result = await Matriculation.findByPk(id, {
      include: [
        { model: Person, as: 'student' },
        { model: Inscription, as: 'inscription' }
      ]
    });
    res.status(201).json({
      message: 'Estudiante inscrito exitosamente',
      matriculation: result,
      reportUuid
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
    // NO filtrar por schoolPeriodId por defecto - mostrar todos los períodos
    if (schoolPeriodId) where.schoolPeriodId = schoolPeriodId;
    if (gradeId) where.gradeId = gradeId;
    if (sectionId) where.sectionId = sectionId;
    if (escolaridad) where.escolaridad = escolaridad;

    // Hide hidden students from non-admin roles
    const userRoles: string[] = (req.session as any).user?.roles || [];
    const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');

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
        { model: Matriculation, as: 'matriculation', include: [{ model: EnrollmentDocument, as: 'documents' }] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Apply canonical subject order per inscription
    const orderMapCache = new Map<string, Map<number, number>>();
    const resolveOrderMap = async (gradeId: number | null, schoolPeriodId: number | null) => {
      const key = `${gradeId}:${schoolPeriodId}`;
      if (orderMapCache.has(key)) return orderMapCache.get(key)!;
      const m = await getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId);
      orderMapCache.set(key, m);
      return m;
    };

    const result = await Promise.all(
      inscriptions.map(async (ins) => {
        const json = ins.toJSON() as any;
        if (json.student) {
          json.student.representativeType = deriveRepresentativeType(json.student.guardians);
        }
        if (Array.isArray(json.subjects) && json.subjects.length) {
          const orderMap = await resolveOrderMap(json.gradeId, json.schoolPeriodId);
          json.subjects = sortSubjectsByOrder(
            json.subjects,
            (s: any) => s.id,
            (s: any) => s.name,
            orderMap
          );
        }
        return json;
      })
    );

    // Filter out hidden students for non-privileged roles
    const filtered = isPrivileged
      ? result
      : result.filter((ins: any) => !ins.matriculation?.hiddenFromControlEstudios);

    res.json(filtered);
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

    // Apply canonical subject order
    const json = inscription.toJSON() as any;
    if (Array.isArray(json.subjects) && json.subjects.length) {
      const orderMap = await getSubjectOrderMapByGradeAndPeriod(json.gradeId, json.schoolPeriodId);
      json.subjects = sortSubjectsByOrder(
        json.subjects,
        (s: any) => s.id,
        (s: any) => s.name,
        orderMap
      );
    }

    res.json(json);
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

    let reportUuid: string | undefined;
    try {
      const report = await generateEnrollmentReport(matriculation.id, t);
      reportUuid = report.uuid;
    } catch (reportError) {
      console.warn('[createInscription] No se pudo generar reporte:', reportError);
    }

    await t.commit();

    res.status(201).json({
      message: 'Solicitud de inscripción registrada exitosamente',
      matriculation,
      reportUuid
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
      const repRelationship = (representativeType === 'sibling' || representativeType === 'grandparent' || representativeType === 'uncle_aunt')
        ? (representativeType as GuardianRelationship)
        : 'representative';
      assignments.push({
        payload: mapToGuardianProfilePayload(representative as CompleteGuardianInput),
        relationship: repRelationship,
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
        include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
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

    // Handle group subject updates (when subjectIds is provided).
    //
    // Per-term choice semantics:
    //  - The change applies from the active term onwards.
    //  - Notes for the old subject are NEVER destroyed. They remain in the
    //    database and reappear if the student switches back. The professor
    //    manually enters notes for the new subject.
    //  - Terms before the active term are never touched.
    if (Array.isArray(subjectIds)) {
      console.log(`[UpdateInscription] Updating group subjects:`, subjectIds);

      const periodGrade = await PeriodGrade.findOne({
        where: {
          schoolPeriodId: inscription.schoolPeriodId,
          gradeId: inscription.gradeId
        },
        include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
        transaction: t
      });

      if (periodGrade && periodGrade.subjects) {
        const groupSubjects = periodGrade.subjects.filter(
          (s: any) => s.subjectGroupId != null
        );

        const activeTerm = await Term.findOne({
          where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
          transaction: t,
        });

        if (activeTerm) {
          for (const subjectId of subjectIds) {
            const subj = groupSubjects.find((s: any) => s.id === Number(subjectId));
            if (!subj || subj.subjectGroupId == null) continue;
            await changeGroupSubjectFromTerm(
              inscription.id,
              subj.subjectGroupId,
              subj.id,
              activeTerm.id,
              { transaction: t }
            );
          }
        } else if (subjectIds.length > 0) {
          // No active term — just ensure InscriptionSubject rows exist.
          for (const subjectId of subjectIds) {
            await InscriptionSubject.findOrCreate({
              where: { inscriptionId: inscription.id, subjectId: Number(subjectId) },
              transaction: t,
            });
          }
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
  try {
    const { person, matriculation, reportUuid } = await registerAndEnrollStudent(req.body);
    res.status(201).json({
      message: 'Solicitud de inscripción registrada exitosamente',
      person,
      matriculation,
      reportUuid
    });
  } catch (error: any) {
    console.error('[registerAndEnroll] Error:', error);
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
      documents,
      subjectIds
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
      const repRelationship = (representativeType === 'sibling' || representativeType === 'grandparent' || representativeType === 'uncle_aunt')
        ? (representativeType as GuardianRelationship)
        : 'representative';
      assignments.push({
        payload: mapToGuardianProfilePayload(representative as CompleteGuardianInput),
        relationship: repRelationship,
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
          include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
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

      // Handle group subject updates (when subjectIds is provided).
      // Same per-term logic as updateInscription: change applies from the
      // active term onwards. Notes are never destroyed.
      if (Array.isArray(subjectIds)) {
        const periodGrade = await PeriodGrade.findOne({
          where: {
            schoolPeriodId: inscription.schoolPeriodId,
            gradeId: inscription.gradeId
          },
          include: [{ model: Subject, as: 'subjects', through: { where: { active: true } } }],
          transaction: t
        });

        if (periodGrade && periodGrade.subjects) {
          const groupSubjects = periodGrade.subjects.filter(
            (s: any) => s.subjectGroupId != null
          );

          const activeTerm = await Term.findOne({
            where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
            transaction: t,
          });

          if (activeTerm) {
            for (const subjectId of subjectIds) {
              const subj = groupSubjects.find((s: any) => s.id === Number(subjectId));
              if (!subj || subj.subjectGroupId == null) continue;
              await changeGroupSubjectFromTerm(
                inscription.id,
                subj.subjectGroupId,
                subj.id,
                activeTerm.id,
                { transaction: t }
              );
            }
          } else if (subjectIds.length > 0) {
            for (const subjectId of subjectIds) {
              await InscriptionSubject.findOrCreate({
                where: { inscriptionId: inscription.id, subjectId: Number(subjectId) },
                transaction: t,
              });
            }
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

const isPrivilegedUser = (req: Request): boolean => {
  const roles: string[] = (req.session as any).user?.roles || [];
  return roles.includes('Master') || roles.includes('Administrador');
};

export const toggleMatriculationVisibility = async (req: Request, res: Response) => {
  try {
    if (!isPrivilegedUser(req)) {
      return res.status(403).json({ error: 'Solo Administradores y Master pueden cambiar la visibilidad' });
    }

    const { id } = req.params;
    const { hidden } = req.body;

    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'El campo "hidden" debe ser booleano' });
    }

    const matriculation = await Matriculation.findByPk(id);
    if (!matriculation) {
      return res.status(404).json({ error: 'Matrícula no encontrada' });
    }

    await matriculation.update({ hiddenFromControlEstudios: hidden });
    res.json({ message: hidden ? 'Estudiante ocultado de Control de Estudios' : 'Estudiante visible para Control de Estudios', hiddenFromControlEstudios: hidden });
  } catch (error: any) {
    console.error('Error toggling visibility:', error);
    res.status(500).json({ error: 'Error al cambiar visibilidad', details: error.message || error });
  }
};

export const bulkToggleMatriculationVisibility = async (req: Request, res: Response) => {
  try {
    if (!isPrivilegedUser(req)) {
      return res.status(403).json({ error: 'Solo Administradores y Master pueden cambiar la visibilidad' });
    }

    const { ids, hidden } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de ids no vacío' });
    }
    if (typeof hidden !== 'boolean') {
      return res.status(400).json({ error: 'El campo "hidden" debe ser booleano' });
    }

    const [updatedCount] = await Matriculation.update(
      { hiddenFromControlEstudios: hidden },
      { where: { id: ids } }
    );

    res.json({
      message: hidden
        ? `${updatedCount} estudiante(s) ocultado(s) de Control de Estudios`
        : `${updatedCount} estudiante(s) visible(s) para Control de Estudios`,
      updatedCount
    });
  } catch (error: any) {
    console.error('Error bulk toggling visibility:', error);
    res.status(500).json({ error: 'Error al cambiar visibilidad masiva', details: error.message || error });
  }
};

// ─── Per-term group subject choices ──────────────────────────────────────

/**
 * GET /api/inscriptions/:id/group-choices
 * Returns the per-term subject choices for every group the student is
 * enrolled in, plus the list of terms and available subjects per group.
 */
export const getGroupSubjectChoices = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const inscription = await Inscription.findByPk(id);
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const [terms, choices, periodGrade] = await Promise.all([
      Term.findAll({
        where: { schoolPeriodId: inscription.schoolPeriodId },
        order: [['order', 'ASC']],
      }),
      InscriptionGroupTermChoice.findAll({ where: { inscriptionId: Number(id) } }),
      PeriodGrade.findOne({
        where: { schoolPeriodId: inscription.schoolPeriodId, gradeId: inscription.gradeId },
        include: [{
          model: Subject,
          as: 'subjects',
          through: { where: { active: true } },
          include: [{ model: SubjectGroup, as: 'subjectGroup' }],
        }],
      }),
    ]);

    const groupSubjects = (periodGrade?.subjects || []).filter((s: any) => s.subjectGroupId != null) as any[];
    const groups: { id: number; name: string; subjects: { id: number; name: string }[] }[] = [];
    const seen = new Map<number, { id: number; name: string; subjects: { id: number; name: string }[] }>();
    for (const s of groupSubjects) {
      const gid: number = s.subjectGroupId;
      let g = seen.get(gid);
      if (!g) {
        g = { id: gid, name: s.subjectGroup?.name || `Grupo ${gid}`, subjects: [] };
        seen.set(gid, g);
        groups.push(g);
      }
      g.subjects.push({ id: s.id, name: s.name });
    }

    res.json({
      terms: terms.map(t => ({ id: t.id, name: t.name, order: t.order, isActive: t.isActive })),
      groups,
      choices: choices.map(c => ({
        termId: c.termId,
        subjectGroupId: c.subjectGroupId,
        subjectId: c.subjectId,
      })),
    });
  } catch (error: any) {
    console.error('[getGroupSubjectChoices] Error:', error);
    res.status(500).json({ error: 'Error al obtener elecciones de grupo', details: error.message });
  }
};

/**
 * PUT /api/inscriptions/:id/group-choices
 * Body: { subjectGroupId, termId, subjectId }
 * Explicitly sets the subject for a single term (backfill UI).
 */
export const setGroupSubjectForTerm = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { subjectGroupId, termId, subjectId } = req.body;
    if (!subjectGroupId || !termId || !subjectId) {
      await t.rollback();
      return res.status(400).json({ error: 'subjectGroupId, termId y subjectId son obligatorios' });
    }
    await setGroupSubjectForTermSvc(Number(id), Number(subjectGroupId), Number(termId), Number(subjectId), { transaction: t });
    await t.commit();
    res.json({ message: 'Elección de materia guardada correctamente' });
  } catch (error: any) {
    if (t) await t.rollback();
    console.error('[setGroupSubjectForTerm] Error:', error);
    res.status(500).json({ error: 'Error al guardar la elección', details: error.message });
  }
};

/**
 * POST /api/inscriptions/:id/group-choices/check
 * Body: { subjectId }
 * Pre-flight check: tells the frontend whether the student already has notes
 * for their current group subject in the active term. Notes are NEVER
 * destroyed by a switch — this endpoint exists only so the UI can inform the
 * user that the old notes exist and will be hidden (but preserved) until the
 * student switches back.
 */
export const checkGroupSubjectChangeImpact = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subjectId } = req.body;
    if (!subjectId) return res.status(400).json({ error: 'subjectId es obligatorio' });

    const inscription = await Inscription.findByPk(id);
    if (!inscription) return res.status(404).json({ error: 'Inscripción no encontrada' });

    const activeTerm = await Term.findOne({
      where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
    });
    if (!activeTerm) {
      return res.json({ hasNotesInActiveTerm: false, activeTermId: null, currentSubjectId: null });
    }

    const currentChoice = await InscriptionGroupTermChoice.findOne({
      where: { inscriptionId: Number(id), termId: activeTerm.id },
    });
    if (!currentChoice || currentChoice.subjectId === Number(subjectId)) {
      return res.json({ hasNotesInActiveTerm: false, activeTermId: activeTerm.id, currentSubjectId: currentChoice?.subjectId ?? null });
    }

    const oldInsSubj = await InscriptionSubject.findOne({
      where: { inscriptionId: Number(id), subjectId: currentChoice.subjectId },
    });
    let hasNotes = false;
    if (oldInsSubj) {
      const tg = await SubjectTermGrade.findOne({
        where: { inscriptionSubjectId: oldInsSubj.id, termId: activeTerm.id },
      });
      hasNotes = !!tg;
    }

    res.json({
      hasNotesInActiveTerm: hasNotes,
      activeTermId: activeTerm.id,
      currentSubjectId: currentChoice.subjectId,
    });
  } catch (error: any) {
    console.error('[checkGroupSubjectChangeImpact] Error:', error);
    res.status(500).json({ error: 'Error al verificar impacto', details: error.message });
  }
};
