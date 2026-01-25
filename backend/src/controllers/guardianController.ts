import { Request, Response } from 'express';
import { GuardianDocumentType } from '@/models/GuardianProfile';
import { findGuardianProfile, findOrCreateGuardianProfile } from '@/services/guardianProfileService';
import { Person, User, StudentGuardian, GuardianProfile, Inscription, Grade, Section, SchoolPeriod } from '@/models/index';

export const searchGuardian = async (req: Request, res: Response) => {
  try {
    const { documentType, document } = req.query;

    if (!documentType || !document) {
      return res.status(400).json({ error: 'documentType y document son obligatorios' });
    }

    const normalizedDoc = (document as string).trim();
    const typeValue = documentType as GuardianDocumentType;

    // 1. Search for existing profile or person
    const found = await findGuardianProfile(typeValue, normalizedDoc);

    if (found) {
      // 2. Ensure a real GuardianProfile record exists.
      // If 'found' came from Person table, 'found.id' is Person.id, which is WRONG for GuardianProfile.
      // We must find or create the actual GuardianProfile record to return the correct GuardianProfile.id.
      const realProfile = await findOrCreateGuardianProfile({
        firstName: found.firstName,
        lastName: found.lastName,
        document: found.document,
        documentType: found.documentType,
        email: found.email || '',
        phone: found.phone || '',
        address: found.address || '',
        residenceState: found.residenceState || '',
        residenceMunicipality: found.residenceMunicipality || '',
        residenceParish: found.residenceParish || '',
        occupation: found.occupation
      });

      return res.json(realProfile);
    }

    return res.status(404).json({ error: 'Representante no encontrado' });
  } catch (error) {
    console.error('Error searching guardian:', error);
    return res.status(500).json({ error: 'Error buscando representante' });
  }
};

export const createGuardian = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, documentType, document, phone, email, residenceState, residenceMunicipality, residenceParish, address } = req.body || {};

    // Validate required fields
    if (!firstName || !lastName || !documentType || !document) {
      return res.status(400).json({ error: 'Datos básicos son obligatorios (Nombres, Apellidos, Documento)' });
    }

    const normalizedDoc = (document as string).trim();
    const typeValue = documentType as GuardianDocumentType;

    const created = await findOrCreateGuardianProfile({
      firstName,
      lastName,
      document: normalizedDoc,
      documentType: typeValue,
      phone,
      email,
      residenceState,
      residenceMunicipality,
      residenceParish,
      address,
      // Add other fields if needed, e.g. occupation
      occupation: req.body.occupation
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('Error creating guardian:', error);
    return res.status(500).json({ error: 'Error creando representante' });
  }
};

export const getMyStudents = async (req: Request, res: Response) => {
  try {
    const currentUser = (req.session as any).user;
    if (!currentUser || !currentUser.id) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // 1. Get the Person record for the logged-in user
    const person = await Person.findOne({ where: { userId: currentUser.id } });
    if (!person) {
      return res.status(404).json({ message: 'Perfil de persona no encontrado para este usuario' });
    }

    // 2. Find the GuardianProfile matching this person's document
    // Note: In the future we might want a direct link, but for now we match by document
    const guardianProfile = await GuardianProfile.findOne({
      where: {
        document: person.document,
        documentType: person.documentType
      }
    });

    if (!guardianProfile) {
      // User exists but is not registered as a guardian for any student yet
      return res.json([]);
    }

    // 3. Find all students linked to this guardian
    const studentGuardians = await StudentGuardian.findAll({
      where: { guardianId: guardianProfile.id },
      include: [
        {
          model: Person,
          as: 'student',
          include: [
            {
              model: Inscription,
              as: 'inscriptions',
              required: false,
              limit: 1,
              order: [['createdAt', 'DESC']], // Get latest inscription
              include: [
                { model: Grade, as: 'grade' },
                { model: Section, as: 'section' },
                { model: SchoolPeriod, as: 'period' }
              ]
            }
          ]
        }
      ]
    });

    // 4. Format the response
    const students = studentGuardians.map(sg => {
      const student = (sg as any).student;
      if (!student) return null;

      const latestInscription = student.inscriptions && student.inscriptions.length > 0
        ? student.inscriptions[0]
        : null;

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        documentType: student.documentType,
        document: student.document,
        gender: student.gender,
        birthdate: student.birthdate,
        relationship: sg.relationship,
        isRepresentative: sg.isRepresentative,
        inscription: latestInscription ? {
          grade: latestInscription.grade?.name,
          section: latestInscription.section?.name,
          period: latestInscription.period?.name,
          status: 'Inscrito' // You might want to derive this from actual status if available
        } : null
      };
    }).filter(s => s !== null);

    res.json(students);
  } catch (error) {
    console.error('Error fetching represented students:', error);
    res.status(500).json({ message: 'Error al obtener estudiantes representados' });
  }
};
