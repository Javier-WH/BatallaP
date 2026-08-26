import { Request, Response } from 'express';
import { User, Person, Role, Contact, PersonRole, GuardianProfile, SchoolPeriod, Inscription, Matriculation, StudentGuardian } from '@/models/index';
import sequelize from '@/config/database';
import { Op, literal } from 'sequelize';
import { fieldExpr, quoteQualified } from '@/services/studentSortService';
import bcrypt from 'bcrypt';
import { parsePagination, buildPaginatedResponse } from '@/services/paginationService';

// Canonical role name sets used by the activeOnly filter.
const EXEMPT_ROLES = ['Master', 'Administrador', 'Control de Estudios', 'Profesor', 'Representante'];
const STUDENT_ROLES = ['Alumno'];

export const searchUsers = async (req: Request, res: Response) => {
  try {
    const { q, activeOnly, schoolPeriodId } = req.query;
    const query = q ? String(q) : '';
    const activeOnlyBool = String(activeOnly) === 'true';
    const pagination = parsePagination(req.query as Record<string, unknown>);

    const whereClause: any = {};
    if (query) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${query}%` } },
        { lastName: { [Op.like]: `%${query}%` } },
        { document: { [Op.like]: `%${query}%` } }
      ];
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    const targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : (activePeriod?.id);

    // Build the role-based filter in SQL when activeOnly=true so that pagination
    // is consistent (the old JS post-filter would break page counts).
    //
    // activeOnly logic:
    //   - Exempt roles (Master/Admin/ControlEstudios/Profesor/Representante) → always shown.
    //   - Non-student, non-exempt users → always shown.
    //   - Students (Alumno) → only shown if they have an Inscription or Matriculation
    //     in the target period (when a period is specified), or hidden entirely
    //     when no period is specified.
    //
    // We express this as: (has exempt role) OR (NOT a student) OR (student AND has period enrollment)
    // When no period: (has exempt role) OR (NOT a student)
    const roleInclude: any = {
      model: Role,
      as: 'roles',
      through: { attributes: [] },
      attributes: ['id', 'name'],
    };

    const inscriptionInclude: any = {
      model: Inscription,
      as: 'inscriptions',
      required: false,
      where: targetPeriodId ? { schoolPeriodId: targetPeriodId } : undefined,
      attributes: ['id', 'schoolPeriodId'],
    };

    const matriculationInclude: any = {
      model: Matriculation,
      as: 'matriculations',
      required: false,
      where: targetPeriodId ? { schoolPeriodId: targetPeriodId } : undefined,
      attributes: ['id', 'schoolPeriodId'],
    };

    if (activeOnlyBool) {
      // Sub-query: person has at least one exempt role.
      const hasExemptRoleSub = `(SELECT COUNT(*) FROM person_roles pr_ex
        INNER JOIN roles r_ex ON r_ex.id = pr_ex.roleId
        WHERE pr_ex.personId = Person.id AND r_ex.name IN (${EXEMPT_ROLES.map(r => `'${r}'`).join(',')})) > 0`;

      // Sub-query: person has at least one student role.
      const hasStudentRoleSub = `(SELECT COUNT(*) FROM person_roles pr_st
        INNER JOIN roles r_st ON r_st.id = pr_st.roleId
        WHERE pr_st.personId = Person.id AND r_st.name IN (${STUDENT_ROLES.map(r => `'${r}'`).join(',')})) > 0`;

      if (targetPeriodId) {
        // (exempt) OR (NOT student) OR (student AND has inscription/matriculation in period)
        // The "has inscription/matriculation in period" is handled by the includes
        // with required: false + a HAVING-like condition. Since Sequelize doesn't
        // support HAVING on findAll directly, we use a literal in WHERE that
        // checks the existence via correlated subqueries.
        const hasPeriodEnrollmentSub = `(
          (SELECT COUNT(*) FROM inscriptions i_per
            WHERE i_per.personId = Person.id AND i_per.schoolPeriodId = ${targetPeriodId}) > 0
          OR
          (SELECT COUNT(*) FROM matriculations m_per
            WHERE m_per.personId = Person.id AND m_per.schoolPeriodId = ${targetPeriodId}) > 0
        )`;

        whereClause[Op.and] = [
          literal(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub} OR ${hasPeriodEnrollmentSub})`),
        ];
      } else {
        // No period: (exempt) OR (NOT student)
        whereClause[Op.and] = [
          literal(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub})`),
        ];
        // When no period, we don't need the inscription/matriculation includes
        // for filtering, but we keep them for the response shape (they'll be empty).
      }
    }

    // "IDs first, then hydrate" pattern for paginated mode.
    // In unpaginated mode (no page/pageSize), preserve legacy behavior: return
    // flat array with limit: 2000 (same as before) so existing consumers don't break.
    if (!pagination.isPaginated) {
      const people = await Person.findAll({
        where: whereClause,
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          roleInclude,
          inscriptionInclude,
          matriculationInclude,
        ],
        limit: 2000,
      });

      // Legacy JS post-filter (kept for backward compat in unpaginated mode).
      let results = people;
      if (activeOnlyBool) {
        const exemptRolesLower = EXEMPT_ROLES.map(r => r.toLowerCase());
        const studentRolesLower = STUDENT_ROLES.map(r => r.toLowerCase());
        results = people.filter(person => {
          const roles = (person as any).roles || [];
          const hasExemptRole = roles.some((r: any) => exemptRolesLower.includes(r.name.toLowerCase()));
          if (hasExemptRole) return true;
          const isStudent = roles.some((r: any) => studentRolesLower.includes(r.name.toLowerCase()));
          if (!targetPeriodId) return !isStudent;
          if (!isStudent) return true;
          const inscriptions = (person as any).inscriptions || [];
          const matriculations = (person as any).matriculations || [];
          return inscriptions.length > 0 || matriculations.length > 0;
        });
      }

      const users = results.map((person: any) => ({
        id: person.id,
        userId: person.user?.id ?? null,
        username: person.user?.username ?? null,
        firstName: person.firstName,
        lastName: person.lastName,
        document: person.document,
        person: { firstName: person.firstName, lastName: person.lastName, document: person.document },
        roles: person.roles,
      }));

      return res.json(users);
    }

    // Paginated mode: IDs first, then hydrate.
    const idRows = await Person.findAll({
      where: whereClause,
      attributes: ['id'],
      order: [['id', 'ASC']],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
      raw: true,
    });
    const ids = idRows.map((r: any) => r.id);

    const total = await Person.count({ where: whereClause }) as unknown as number;

    let people: Person[] = [];
    if (ids.length > 0) {
      people = await Person.findAll({
        where: { id: { [Op.in]: ids } },
        include: [
          { model: User, as: 'user', attributes: ['id', 'username'] },
          roleInclude,
          inscriptionInclude,
          matriculationInclude,
        ],
        order: [literal(fieldExpr(quoteQualified('Person', 'id'), ids.map(String)))],
      });
    }

    const users = people.map((person: any) => ({
      id: person.id,
      userId: person.user?.id ?? null,
      username: person.user?.username ?? null,
      firstName: person.firstName,
      lastName: person.lastName,
      document: person.document,
      person: { firstName: person.firstName, lastName: person.lastName, document: person.document },
      roles: person.roles,
    }));

    return res.json(buildPaginatedResponse(users, total, pagination));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error searching users' });
  }
};

/**
 * GET /api/users/search/stats
 *
 * Returns the total count for the same filter set accepted by searchUsers,
 * so the frontend can show "N resultados" without downloading the full list.
 */
export const searchUsersStats = async (req: Request, res: Response) => {
  try {
    const { q, activeOnly, schoolPeriodId } = req.query;
    const query = q ? String(q) : '';
    const activeOnlyBool = String(activeOnly) === 'true';

    const whereClause: any = {};
    if (query) {
      whereClause[Op.or] = [
        { firstName: { [Op.like]: `%${query}%` } },
        { lastName: { [Op.like]: `%${query}%` } },
        { document: { [Op.like]: `%${query}%` } }
      ];
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    const targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : (activePeriod?.id);

    if (activeOnlyBool) {
      const hasExemptRoleSub = `(SELECT COUNT(*) FROM person_roles pr_ex
        INNER JOIN roles r_ex ON r_ex.id = pr_ex.roleId
        WHERE pr_ex.personId = Person.id AND r_ex.name IN (${EXEMPT_ROLES.map(r => `'${r}'`).join(',')})) > 0`;
      const hasStudentRoleSub = `(SELECT COUNT(*) FROM person_roles pr_st
        INNER JOIN roles r_st ON r_st.id = pr_st.roleId
        WHERE pr_st.personId = Person.id AND r_st.name IN (${STUDENT_ROLES.map(r => `'${r}'`).join(',')})) > 0`;

      if (targetPeriodId) {
        const hasPeriodEnrollmentSub = `(
          (SELECT COUNT(*) FROM inscriptions i_per
            WHERE i_per.personId = Person.id AND i_per.schoolPeriodId = ${targetPeriodId}) > 0
          OR
          (SELECT COUNT(*) FROM matriculations m_per
            WHERE m_per.personId = Person.id AND m_per.schoolPeriodId = ${targetPeriodId}) > 0
        )`;
        whereClause[Op.and] = [
          literal(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub} OR ${hasPeriodEnrollmentSub})`),
        ];
      } else {
        whereClause[Op.and] = [
          literal(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub})`),
        ];
      }
    }

    const total = await Person.count({ where: whereClause }) as unknown as number;
    return res.json({ total });
  } catch (error) {
    console.error('[searchUsersStats] Error:', error);
    return res.status(500).json({ message: 'Error obteniendo estadísticas de búsqueda' });
  }
};

export const getUserDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // Person ID

    const { TeacherAssignment, PeriodGradeSubject, Subject, PeriodGrade, Grade, Section, SchoolPeriod, PersonResidence, StudentGuardian, GuardianProfile }: any = require('../models');
    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });

    const person = await Person.findByPk(id, {
      include: [
        { model: User, as: 'user' },
        { model: Role, as: 'roles', through: { attributes: [] } },
        { model: Contact, as: 'contact' },
        { model: PersonResidence, as: 'residence' },
        {
          model: StudentGuardian,
          as: 'guardians',
          include: [{ model: GuardianProfile, as: 'profile' }]
        },
        {
          model: TeacherAssignment,
          as: 'teachingAssignments',
          required: false,
          include: [
            {
              model: PeriodGradeSubject,
              as: 'periodGradeSubject',
              required: true,
              include: [
                { model: Subject, as: 'subject' },
                {
                  model: PeriodGrade,
                  as: 'periodGrade',
                  required: true,
                  where: activePeriod ? { schoolPeriodId: activePeriod.id } : {},
                  include: [
                    { model: Grade, as: 'grade' },
                    { model: SchoolPeriod, as: 'schoolPeriod' }
                  ]
                }
              ]
            },
            { model: Section, as: 'section' }
          ]
        }
      ]
    });

    if (!person) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if student and include inscription data
    const roles = (person as any).roles || [];
    const isStudent = roles.some((r: any) =>
      r.name === 'Alumno'
    );

    let inscriptionData = null;
    if (isStudent) {
      const { Inscription } = require('../models');

      // 1. Try to find inscription in the ACTIVE period first
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
      // Residence
      residenceState, residenceMunicipality, residenceParish,
      // Role
      roleName
    } = req.body;

    const person = await Person.findByPk(id, {
      include: [{ model: Role, as: 'roles', through: { attributes: [] } }]
    });
    if (!person) return res.status(404).json({ message: 'Person not found' });

    // Try to find associated GuardianProfile BEFORE updating person (to match by current document)
    const guardianProfile = await GuardianProfile.findOne({
      where: {
        document: person.document,
        documentType: person.documentType
      }
    });

    // Permissions Check
    const currentUser = (req.session as any).user;
    const isMaster = currentUser?.roles?.includes('Master');
    const currentRoles = (person as any).roles || [];
    const targetHasRestrictedRoles = currentRoles.some((r: any) => ['Master', 'Administrador'].includes(r.name));

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

    // Sync with GuardianProfile if it exists
    if (guardianProfile) {
      const guardianUpdates: any = {};
      
      // Basic Info
      if (firstName) guardianUpdates.firstName = firstName;
      if (lastName) guardianUpdates.lastName = lastName;
      if (documentType) guardianUpdates.documentType = documentType;
      if (document) guardianUpdates.document = document;

      // Contact Info (using variables from body, assuming they are what was used to update Contact)
      if (phone1) guardianUpdates.phone = phone1;
      if (email) guardianUpdates.email = email;
      if (address) guardianUpdates.address = address;

      // Residence Info (if provided in update)
      if (residenceState) guardianUpdates.residenceState = residenceState;
      if (residenceMunicipality) guardianUpdates.residenceMunicipality = residenceMunicipality;
      if (residenceParish) guardianUpdates.residenceParish = residenceParish;

      await guardianProfile.update(guardianUpdates);
    }

    // Update Representative (for Students) - If representativeId is provided
    const { representativeId } = req.body;
    
    if (representativeId) {
      const transaction = await sequelize.transaction();
      try {
        console.log('[updateUser] Processing representative update. ID received:', representativeId);
        
        // 1. Verify new representative exists
        const newRep = await GuardianProfile.findByPk(representativeId, { transaction });
        
        if (newRep) {
          console.log('[updateUser] New representative found:', newRep.id, newRep.firstName);
          
          // 2. Find ALL current representative associations to ensure we clear any inconsistencies
          // We need to find anyone who IS a representative OR has the 'representative' relationship
          // to avoid unique constraint violations.
          const currentRepRelations = await StudentGuardian.findAll({
            where: {
              studentId: person.id,
              [Op.or]: [
                { isRepresentative: true },
                { relationship: 'representative' }
              ]
            },
            transaction
          });
          
          console.log(`[updateUser] Found ${currentRepRelations.length} existing representative(s).`);

          let newRepAlreadyLinked = false;

          // Iterate and clear old reps
          for (const rel of currentRepRelations) {
             if (Number(rel.guardianId) === Number(newRep.id)) {
                // This guardian is already the rep.
                newRepAlreadyLinked = true;
                console.log(`[updateUser] Guardian ${rel.guardianId} is already representative. Keeping.`);
             } else {
                // This is an old rep, remove/demote
                if (rel.relationship === 'representative') {
                    console.log(`[updateUser] Destroying representative relation for guardian ${rel.guardianId}`);
                    await rel.destroy({ transaction });
                } else {
                    console.log(`[updateUser] Demoting guardian ${rel.guardianId} (relationship: ${rel.relationship})`);
                    await rel.update({ isRepresentative: false }, { transaction });
                }
             }
          }

          // If the new rep wasn't in the list of current reps, we need to add/promote them
          if (!newRepAlreadyLinked) {
               // Check if they exist as a non-rep guardian (e.g. father/mother)
               const existingRelation = await StudentGuardian.findOne({
                  where: {
                      studentId: person.id,
                      guardianId: newRep.id
                  },
                  transaction
               });
               
               if (existingRelation) {
                   // Promote
                   console.log('[updateUser] Promoting existing guardian to representative');
                   await existingRelation.update({ isRepresentative: true }, { transaction });
               } else {
                   // Create
                   console.log('[updateUser] Creating new representative association');
                   await StudentGuardian.create({
                      studentId: person.id,
                      guardianId: newRep.id,
                      isRepresentative: true,
                      relationship: 'representative'
                   }, { transaction });
               }
          }  
        } else {
          console.log('[updateUser] New representative profile not found in DB');
        }

        await transaction.commit();
      } catch (repError) {
        await transaction.rollback();
        console.error('[updateUser] Error updating representative:', repError);
        throw repError; // Re-throw to ensure the user knows something went wrong
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
      ['Master', 'Administrador'].includes(r.name)
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
