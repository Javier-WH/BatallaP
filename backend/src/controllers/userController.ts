import { Request, Response } from 'express';
import { User, Person, Role, Contact, PersonRole } from '@/models/index';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const query = q ? String(q) : '';

    const whereClause: any = {};
    if (query) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${query}%` } },
        { lastName: { [Op.like]: `%${query}%` } },
        { document: { [Op.like]: `%${query}%` } }
      ];
    }

    const people = await Person.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username']
        },
        {
          model: Role,
          as: 'roles',
          through: { attributes: [] }
        }
      ],
      limit: 20
    });

    res.json(people);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error searching users' });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Person ID

    const person = await Person.findByPk(id, {
      include: [
        { model: User, as: 'user' },
        { model: Role, as: 'roles', through: { attributes: [] } },
        { model: Contact, as: 'contact' }
      ]
    });

    if (!person) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if student and include inscription data
    const roles = (person as any).roles || [];
    const isStudent = roles.some((r: any) =>
      ['student', 'estudiante', 'alumno'].includes(r.name.toLowerCase())
    );

    let inscriptionData = null;
    if (isStudent) {
      const { Inscription, SchoolPeriod, Grade, Section }: any = require('../models');

      // 1. Try to find inscription in the ACTIVE period first
      const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });

      if (activePeriod) {
        inscriptionData = await Inscription.findOne({
          where: { personId: id, schoolPeriodId: activePeriod.id },
          include: [
            { model: SchoolPeriod, as: 'period' },
            { model: Grade, as: 'grade' },
            { model: Section, as: 'section' }
          ]
        });
      }

      // 2. Fallback to the latest one if not found in active or no active period
      if (!inscriptionData) {
        inscriptionData = await Inscription.findOne({
          where: { personId: id },
          include: [
            { model: SchoolPeriod, as: 'period' },
            { model: Grade, as: 'grade' },
            { model: Section, as: 'section' }
          ],
          order: [['createdAt', 'DESC']]
        });
      }
    }

    res.json({
      ...person.toJSON(),
      inscription: inscriptionData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching user details' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Person ID
    const {
      // Person
      firstName, lastName, documentType, document, gender, birthdate,
      // User
      username, password,
      // Contact
      phone1, phone2, email, address, whatsapp,
      // Role
      roleName
    } = req.body;

    const person = await Person.findByPk(id, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
    });
    if (!person) return res.status(404).json({ message: 'Person not found' });

    // Permissions Check
    const currentUser = (req.session as any).user;
    const isMaster = currentUser?.roles?.includes('Master');
    const currentRoles = (person as any).roles || [];
    const targetHasRestrictedRoles = currentRoles.some((r: any) => ['Master', 'Admin'].includes(r.name));

    // Update Person Data (Allowed for all admins)
    await person.update({ firstName, lastName, documentType, document, gender, birthdate });

    // Update User (Account/Security) - Protected for Admin/Master by non-Master
    if (!targetHasRestrictedRoles || isMaster) {
      if (person.userId) {
        const user = await User.findByPk(person.userId);
        if (user && username) {
          user.username = username;
          if (password && password.trim() !== '') {
            user.password = password;
          }
          await user.save();
        }
      } else if (username && password) {
        const newUser = await User.create({ username, password });
        await person.update({ userId: newUser.id });
      }
    }

    // Update Contact
    let contact = await Contact.findOne({ where: { personId: id } });
    if (contact) {
      await contact.update({ phone1, phone2, email, address, whatsapp });
    } else {
      // Create if fields are present
      if (phone1 || address) {
        await Contact.create({
          personId: person.id,
          phone1: phone1 || '',
          address: address || '',
          phone2, email, whatsapp
        });
      }
    }

    // Update Role (Multi-role support) - Protected for Admin/Master by non-Master
    if (!targetHasRestrictedRoles || isMaster) {
      const { roles } = req.body;

      if (roles && Array.isArray(roles)) {
        // Find all role IDs
        const targetRoles = await Role.findAll({ where: { name: { [Op.in]: roles } } });

        if (targetRoles.length > 0) {
          // Clear current roles
          await PersonRole.destroy({ where: { personId: person.id } });

          // Add new roles
          const personRoles = targetRoles.map(role => ({
            personId: person.id,
            roleId: role.id
          }));

          await PersonRole.bulkCreate(personRoles);
        }
      } else if (roleName) { // Fallback for single role update if needed or legacy
        const role = await Role.findOne({ where: { name: roleName } });
        if (role) {
          await PersonRole.destroy({ where: { personId: person.id } });
          await PersonRole.create({ personId: person.id, roleId: role.id });
        }
      }
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

export const deleteUserAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Person ID
    const person = await Person.findByPk(id, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
    });

    if (!person) {
      return res.status(404).json({ message: 'Persona no encontrada' });
    }

    if (!person.userId) {
      return res.status(400).json({ message: 'Esta persona no tiene una cuenta vinculada' });
    }

    const userId = person.userId;

    // Check permissions: only Master can delete Admin or Master accounts
    const currentUser = (req.session as any).user;
    const isMaster = currentUser?.roles?.includes('Master');

    // cast to any to access included roles from association in plain sequelize
    const roles = (person as any).roles || [];
    const targetHasRestrictedRoles = roles.some((r: any) =>
      ['Master', 'Admin'].includes(r.name)
    );

    if (targetHasRestrictedRoles && !isMaster) {
      return res.status(403).json({
        message: 'No tienes permisos para eliminar la cuenta de un administrador o master'
      });
    }

    // 1. Dissociate person from user
    await person.update({ userId: null });

    // 2. Delete the user record
    await User.destroy({ where: { id: userId } });

    res.json({ message: 'Cuenta de acceso eliminada correctamente' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({ message: 'Error al eliminar la cuenta de acceso' });
  }
};
