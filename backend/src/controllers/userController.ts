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
      // Import Inscription model dynamically to avoid circular dependency issues at top
      const { Inscription, SchoolPeriod, Grade, Section }: any = require('../models');

      // Get the most recent/active inscription
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

    const person = await Person.findByPk(id);
    if (!person) return res.status(404).json({ message: 'Person not found' });

    // Update Person
    await person.update({ firstName, lastName, documentType, document, gender, birthdate });

    // Update User
    if (person.userId) {
      const user = await User.findByPk(person.userId);
      if (user) {
        const userUpdates: any = { username };
        if (password && password.trim() !== '') {
          // Hash password manually or let hook handle it if changed
          // Since update hook handles changed('password'), just setting it might be enough if model is setup right.
          // However, hooks on bulk update might fail, but on instance update it works. 
          // Let's rely on the model hook for beforeUpdate
          user.password = password;
        }
        user.username = username;
        await user.save();
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

    // Update Role (Multi-role support)
    // Expecting 'roles' as an array of role names strings
    const { roles } = req.body;

    if (roles && Array.isArray(roles)) {
      // Find all role IDs
      const targetRoles = await Role.findAll({ where: { name: { [Op.in]: roles } } });

      if (targetRoles.length > 0) {
        // Clear current roles
        await PersonRole.destroy({ where: { personId: person.id } });

        // Add new roles
        // Ideally use bulkCreate
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

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating user' });
  }
}
