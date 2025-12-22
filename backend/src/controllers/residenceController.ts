import { Request, Response } from 'express';
import { Person, PersonResidence, Role } from '@/models/index';

const REQUIRED_FIELDS = [
  'birthState',
  'birthMunicipality',
  'birthParish',
  'residenceState',
  'residenceMunicipality',
  'residenceParish'
] as const;

const validateBody = (body: Record<string, unknown>) => {
  const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
  return {
    isValid: missing.length === 0,
    missing
  };
};

const ensureStudentRole = (roles?: Role[]) => {
  if (!roles || roles.length === 0) return false;
  return roles.some((role) => role.name === 'Alumno');
};

export const getResidenceByPerson = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;

    const residence = await PersonResidence.findOne({
      where: { personId }
    });

    if (!residence) {
      return res.status(404).json({ message: 'Residencia no registrada para esta persona' });
    }

    res.json(residence);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener la residencia' });
  }
};

export const upsertResidenceByPerson = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    const validation = validateBody(req.body);

    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Todos los campos son obligatorios',
        missing: validation.missing
      });
    }

    const person = await Person.findByPk(personId, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
    });

    if (!person) {
      return res.status(404).json({ message: 'Persona no encontrada' });
    }

    if (!ensureStudentRole(person.roles)) {
      return res.status(400).json({ message: 'Solo se permite registrar residencia para estudiantes' });
    }

    const [residence, created] = await PersonResidence.findOrCreate({
      where: { personId: Number(personId) },
      defaults: {
        personId: Number(personId),
        birthState: req.body.birthState,
        birthMunicipality: req.body.birthMunicipality,
        birthParish: req.body.birthParish,
        residenceState: req.body.residenceState,
        residenceMunicipality: req.body.residenceMunicipality,
        residenceParish: req.body.residenceParish
      }
    });

    if (!created) {
      await residence.update({
        birthState: req.body.birthState,
        birthMunicipality: req.body.birthMunicipality,
        birthParish: req.body.birthParish,
        residenceState: req.body.residenceState,
        residenceMunicipality: req.body.residenceMunicipality,
        residenceParish: req.body.residenceParish
      });
    }

    res.status(created ? 201 : 200).json(residence);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar la residencia' });
  }
};
