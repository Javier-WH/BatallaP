"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.updateUser = exports.getUserDetails = exports.searchUsersStats = exports.searchUsers = void 0;
const index_1 = require("../models/index.js");
const database_1 = __importDefault(require("../config/database.js"));
const sequelize_1 = require("sequelize");
const studentSortService_1 = require("../services/studentSortService.js");
const paginationService_1 = require("../services/paginationService.js");
// Canonical role name sets used by the activeOnly filter.
const EXEMPT_ROLES = ['Master', 'Administrador', 'Control de Estudios', 'Profesor', 'Representante'];
const STUDENT_ROLES = ['Alumno'];
const searchUsers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, activeOnly, schoolPeriodId } = req.query;
        const query = q ? String(q) : '';
        const activeOnlyBool = String(activeOnly) === 'true';
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        const whereClause = {};
        if (query) {
            whereClause[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: `%${query}%` } },
                { lastName: { [sequelize_1.Op.like]: `%${query}%` } },
                { document: { [sequelize_1.Op.like]: `%${query}%` } }
            ];
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        const targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : (activePeriod === null || activePeriod === void 0 ? void 0 : activePeriod.id);
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
        const roleInclude = {
            model: index_1.Role,
            as: 'roles',
            through: { attributes: [] },
            attributes: ['id', 'name'],
        };
        const inscriptionInclude = {
            model: index_1.Inscription,
            as: 'inscriptions',
            required: false,
            where: targetPeriodId ? { schoolPeriodId: targetPeriodId } : undefined,
            attributes: ['id', 'schoolPeriodId'],
        };
        const matriculationInclude = {
            model: index_1.Matriculation,
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
                whereClause[sequelize_1.Op.and] = [
                    (0, sequelize_1.literal)(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub} OR ${hasPeriodEnrollmentSub})`),
                ];
            }
            else {
                // No period: (exempt) OR (NOT student)
                whereClause[sequelize_1.Op.and] = [
                    (0, sequelize_1.literal)(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub})`),
                ];
                // When no period, we don't need the inscription/matriculation includes
                // for filtering, but we keep them for the response shape (they'll be empty).
            }
        }
        // "IDs first, then hydrate" pattern for paginated mode.
        // In unpaginated mode (no page/pageSize), preserve legacy behavior: return
        // flat array with limit: 2000 (same as before) so existing consumers don't break.
        if (!pagination.isPaginated) {
            const people = yield index_1.Person.findAll({
                where: whereClause,
                include: [
                    { model: index_1.User, as: 'user', attributes: ['id', 'username'] },
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
                    const roles = person.roles || [];
                    const hasExemptRole = roles.some((r) => exemptRolesLower.includes(r.name.toLowerCase()));
                    if (hasExemptRole)
                        return true;
                    const isStudent = roles.some((r) => studentRolesLower.includes(r.name.toLowerCase()));
                    if (!targetPeriodId)
                        return !isStudent;
                    if (!isStudent)
                        return true;
                    const inscriptions = person.inscriptions || [];
                    const matriculations = person.matriculations || [];
                    return inscriptions.length > 0 || matriculations.length > 0;
                });
            }
            const users = results.map((person) => {
                var _a, _b, _c, _d, _e;
                return ({
                    id: person.id,
                    userId: (_b = (_a = person.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
                    username: (_d = (_c = person.user) === null || _c === void 0 ? void 0 : _c.username) !== null && _d !== void 0 ? _d : null,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    document: person.document,
                    hireDate: (_e = person.hireDate) !== null && _e !== void 0 ? _e : null,
                    person: { firstName: person.firstName, lastName: person.lastName, document: person.document },
                    roles: person.roles,
                });
            });
            return res.json(users);
        }
        // Paginated mode: IDs first, then hydrate.
        const idRows = yield index_1.Person.findAll({
            where: whereClause,
            attributes: ['id'],
            order: [['id', 'ASC']],
            limit: pagination.limit,
            offset: pagination.offset,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        const total = yield index_1.Person.count({ where: whereClause });
        let people = [];
        if (ids.length > 0) {
            people = yield index_1.Person.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: [
                    { model: index_1.User, as: 'user', attributes: ['id', 'username'] },
                    roleInclude,
                    inscriptionInclude,
                    matriculationInclude,
                ],
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('Person', 'id'), ids.map(String)))],
            });
        }
        const users = people.map((person) => {
            var _a, _b, _c, _d, _e;
            return ({
                id: person.id,
                userId: (_b = (_a = person.user) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
                username: (_d = (_c = person.user) === null || _c === void 0 ? void 0 : _c.username) !== null && _d !== void 0 ? _d : null,
                firstName: person.firstName,
                lastName: person.lastName,
                document: person.document,
                hireDate: (_e = person.hireDate) !== null && _e !== void 0 ? _e : null,
                person: { firstName: person.firstName, lastName: person.lastName, document: person.document },
                roles: person.roles,
            });
        });
        return res.json((0, paginationService_1.buildPaginatedResponse)(users, total, pagination));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error searching users' });
    }
});
exports.searchUsers = searchUsers;
/**
 * GET /api/users/search/stats
 *
 * Returns the total count for the same filter set accepted by searchUsers,
 * so the frontend can show "N resultados" without downloading the full list.
 */
const searchUsersStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, activeOnly, schoolPeriodId } = req.query;
        const query = q ? String(q) : '';
        const activeOnlyBool = String(activeOnly) === 'true';
        const whereClause = {};
        if (query) {
            whereClause[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: `%${query}%` } },
                { lastName: { [sequelize_1.Op.like]: `%${query}%` } },
                { document: { [sequelize_1.Op.like]: `%${query}%` } }
            ];
        }
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        const targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : (activePeriod === null || activePeriod === void 0 ? void 0 : activePeriod.id);
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
                whereClause[sequelize_1.Op.and] = [
                    (0, sequelize_1.literal)(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub} OR ${hasPeriodEnrollmentSub})`),
                ];
            }
            else {
                whereClause[sequelize_1.Op.and] = [
                    (0, sequelize_1.literal)(`(${hasExemptRoleSub} OR NOT ${hasStudentRoleSub})`),
                ];
            }
        }
        const total = yield index_1.Person.count({ where: whereClause });
        return res.json({ total });
    }
    catch (error) {
        console.error('[searchUsersStats] Error:', error);
        return res.status(500).json({ message: 'Error obteniendo estadísticas de búsqueda' });
    }
});
exports.searchUsersStats = searchUsersStats;
const getUserDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // Person ID
        const { TeacherAssignment, PeriodGradeSubject, Subject, PeriodGrade, Grade, Section, SchoolPeriod, PersonResidence, StudentGuardian, GuardianProfile } = require('../models');
        const activePeriod = yield SchoolPeriod.findOne({ where: { status: 'activo' } });
        const person = yield index_1.Person.findByPk(id, {
            include: [
                { model: index_1.User, as: 'user' },
                { model: index_1.Role, as: 'roles', through: { attributes: [] } },
                { model: index_1.Contact, as: 'contact' },
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
        const roles = person.roles || [];
        const isStudent = roles.some((r) => r.name === 'Alumno');
        let inscriptionData = null;
        if (isStudent) {
            const { Inscription } = require('../models');
            // 1. Try to find inscription in the ACTIVE period first
            if (activePeriod) {
                inscriptionData = yield Inscription.findOne({
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
                inscriptionData = yield Inscription.findOne({
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
        res.json(Object.assign(Object.assign({}, person.toJSON()), { inscription: inscriptionData }));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching user details' });
    }
});
exports.getUserDetails = getUserDetails;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params; // Person ID
        const { 
        // Person
        firstName, lastName, documentType, document, gender, birthdate, hireDate, 
        // User
        username, password, 
        // Contact
        phone1, phone2, email, address, whatsapp, 
        // Residence
        residenceState, residenceMunicipality, residenceParish, 
        // Role
        roleName } = req.body;
        const person = yield index_1.Person.findByPk(id, {
            include: [{ model: index_1.Role, as: 'roles', through: { attributes: [] } }]
        });
        if (!person)
            return res.status(404).json({ message: 'Person not found' });
        // Try to find associated GuardianProfile BEFORE updating person (to match by current document)
        const guardianProfile = yield index_1.GuardianProfile.findOne({
            where: {
                document: person.document,
                documentType: person.documentType
            }
        });
        // Permissions Check
        const currentUser = req.session.user;
        const isMaster = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.roles) === null || _a === void 0 ? void 0 : _a.includes('Master');
        const currentRoles = person.roles || [];
        const targetHasRestrictedRoles = currentRoles.some((r) => ['Master', 'Administrador', 'Director'].includes(r.name));
        // Update Person Data (Allowed for all admins)
        yield person.update({ firstName, lastName, documentType, document, gender, birthdate, hireDate: hireDate || null });
        // Update User (Account/Security) - Protected for Admin/Master by non-Master
        if (!targetHasRestrictedRoles || isMaster) {
            if (person.userId) {
                const user = yield index_1.User.findByPk(person.userId);
                if (user && username) {
                    user.username = username;
                    if (password && password.trim() !== '') {
                        user.password = password;
                    }
                    yield user.save();
                }
            }
            else if (username && password) {
                const newUser = yield index_1.User.create({ username, password });
                yield person.update({ userId: newUser.id });
            }
        }
        // Update Contact
        let contact = yield index_1.Contact.findOne({ where: { personId: id } });
        if (contact) {
            yield contact.update({ phone1, phone2, email, address, whatsapp });
        }
        else {
            // Create if fields are present
            if (phone1 || address) {
                yield index_1.Contact.create({
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
                const targetRoles = yield index_1.Role.findAll({ where: { name: { [sequelize_1.Op.in]: roles } } });
                if (targetRoles.length > 0) {
                    // Clear current roles
                    yield index_1.PersonRole.destroy({ where: { personId: person.id } });
                    // Add new roles
                    const personRoles = targetRoles.map(role => ({
                        personId: person.id,
                        roleId: role.id
                    }));
                    yield index_1.PersonRole.bulkCreate(personRoles);
                }
            }
            else if (roleName) { // Fallback for single role update if needed or legacy
                const role = yield index_1.Role.findOne({ where: { name: roleName } });
                if (role) {
                    yield index_1.PersonRole.destroy({ where: { personId: person.id } });
                    yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
                }
            }
        }
        // Sync with GuardianProfile if it exists
        if (guardianProfile) {
            const guardianUpdates = {};
            // Basic Info
            if (firstName)
                guardianUpdates.firstName = firstName;
            if (lastName)
                guardianUpdates.lastName = lastName;
            if (documentType)
                guardianUpdates.documentType = documentType;
            if (document)
                guardianUpdates.document = document;
            // Contact Info (using variables from body, assuming they are what was used to update Contact)
            if (phone1)
                guardianUpdates.phone = phone1;
            if (email)
                guardianUpdates.email = email;
            if (address)
                guardianUpdates.address = address;
            // Residence Info (if provided in update)
            if (residenceState)
                guardianUpdates.residenceState = residenceState;
            if (residenceMunicipality)
                guardianUpdates.residenceMunicipality = residenceMunicipality;
            if (residenceParish)
                guardianUpdates.residenceParish = residenceParish;
            yield guardianProfile.update(guardianUpdates);
        }
        // Update Representative (for Students) - If representativeId is provided
        const { representativeId } = req.body;
        if (representativeId) {
            const transaction = yield database_1.default.transaction();
            try {
                console.log('[updateUser] Processing representative update. ID received:', representativeId);
                // 1. Verify new representative exists
                const newRep = yield index_1.GuardianProfile.findByPk(representativeId, { transaction });
                if (newRep) {
                    console.log('[updateUser] New representative found:', newRep.id, newRep.firstName);
                    // 2. Find ALL current representative associations to ensure we clear any inconsistencies
                    // We need to find anyone who IS a representative OR has the 'representative' relationship
                    // to avoid unique constraint violations.
                    const currentRepRelations = yield index_1.StudentGuardian.findAll({
                        where: {
                            studentId: person.id,
                            [sequelize_1.Op.or]: [
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
                        }
                        else {
                            // This is an old rep, remove/demote
                            if (rel.relationship === 'representative') {
                                console.log(`[updateUser] Destroying representative relation for guardian ${rel.guardianId}`);
                                yield rel.destroy({ transaction });
                            }
                            else {
                                console.log(`[updateUser] Demoting guardian ${rel.guardianId} (relationship: ${rel.relationship})`);
                                yield rel.update({ isRepresentative: false }, { transaction });
                            }
                        }
                    }
                    // If the new rep wasn't in the list of current reps, we need to add/promote them
                    if (!newRepAlreadyLinked) {
                        // Check if they exist as a non-rep guardian (e.g. father/mother)
                        const existingRelation = yield index_1.StudentGuardian.findOne({
                            where: {
                                studentId: person.id,
                                guardianId: newRep.id
                            },
                            transaction
                        });
                        if (existingRelation) {
                            // Promote
                            console.log('[updateUser] Promoting existing guardian to representative');
                            yield existingRelation.update({ isRepresentative: true }, { transaction });
                        }
                        else {
                            // Create
                            console.log('[updateUser] Creating new representative association');
                            yield index_1.StudentGuardian.create({
                                studentId: person.id,
                                guardianId: newRep.id,
                                isRepresentative: true,
                                relationship: 'representative'
                            }, { transaction });
                        }
                    }
                }
                else {
                    console.log('[updateUser] New representative profile not found in DB');
                }
                yield transaction.commit();
            }
            catch (repError) {
                yield transaction.rollback();
                console.error('[updateUser] Error updating representative:', repError);
                throw repError; // Re-throw to ensure the user knows something went wrong
            }
        }
        res.json({ message: 'User updated successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating user' });
    }
});
exports.updateUser = updateUser;
const deleteUserAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params; // Person ID
        const person = yield index_1.Person.findByPk(id, {
            include: [{ model: index_1.Role, as: 'roles', through: { attributes: [] } }]
        });
        if (!person) {
            return res.status(404).json({ message: 'Persona no encontrada' });
        }
        if (!person.userId) {
            return res.status(400).json({ message: 'Esta persona no tiene una cuenta vinculada' });
        }
        const userId = person.userId;
        // Check permissions: only Master can delete Admin or Master accounts
        const currentUser = req.session.user;
        const isMaster = (_a = currentUser === null || currentUser === void 0 ? void 0 : currentUser.roles) === null || _a === void 0 ? void 0 : _a.includes('Master');
        // cast to any to access included roles from association in plain sequelize
        const roles = person.roles || [];
        const targetHasRestrictedRoles = roles.some((r) => ['Master', 'Administrador'].includes(r.name));
        if (targetHasRestrictedRoles && !isMaster) {
            return res.status(403).json({
                message: 'No tienes permisos para eliminar la cuenta de un administrador o master'
            });
        }
        // 1. Dissociate person from user
        yield person.update({ userId: null });
        // 2. Delete the user record
        yield index_1.User.destroy({ where: { id: userId } });
        res.json({ message: 'Cuenta de acceso eliminada correctamente' });
    }
    catch (error) {
        console.error('Error deleting user account:', error);
        res.status(500).json({ message: 'Error al eliminar la cuenta de acceso' });
    }
});
exports.deleteUserAccount = deleteUserAccount;
