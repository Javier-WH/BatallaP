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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnifiedAuditLog = exports.getAuditLog = exports.checkPermission = exports.revokePermission = exports.getPermissions = exports.createPermission = void 0;
const sequelize_1 = require("sequelize");
const studentSortService_1 = require("../services/studentSortService.js");
const index_1 = require("../models/index.js");
const paginationService_1 = require("../services/paginationService.js");
// Helper function to check if user has required role
const hasRole = (user, roles) => {
    if (!user || !user.roles)
        return false;
    const userRoles = user.roles.map((r) => typeof r === 'string' ? r : r.name);
    return roles.some(role => userRoles.includes(role));
};
const createPermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        // Only Master and Administrador can create permissions
        if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
            return res.status(403).json({ message: 'Solo Master y Administrador pueden otorgar permisos' });
        }
        const { schoolPeriodId, grantedTo, actCode, observations } = req.body;
        if (!grantedTo || !actCode || !observations) {
            return res.status(400).json({ message: 'grantedTo, actCode y observations son requeridos' });
        }
        // Verify that grantedTo is a Control de Estudios user
        const targetUser = yield index_1.User.findByPk(grantedTo, {
            include: [
                {
                    model: index_1.Person,
                    as: 'person',
                    include: [
                        {
                            model: index_1.Role,
                            as: 'roles'
                        }
                    ]
                }
            ]
        });
        if (!targetUser) {
            return res.status(404).json({ message: 'Usuario receptor no encontrado' });
        }
        const targetRoles = ((_b = (_a = targetUser.person) === null || _a === void 0 ? void 0 : _a.roles) === null || _b === void 0 ? void 0 : _b.map((r) => r.name)) || [];
        if (!targetRoles.includes('Control de Estudios')) {
            return res.status(400).json({ message: 'El permiso solo puede otorgarse a usuarios con rol Control de Estudios' });
        }
        // If schoolPeriodId is provided, verify it exists
        if (schoolPeriodId) {
            const period = yield index_1.SchoolPeriod.findByPk(schoolPeriodId);
            if (!period) {
                return res.status(404).json({ message: 'Período escolar no encontrado' });
            }
        }
        const permission = yield index_1.GradeEditPermission.create({
            schoolPeriodId: schoolPeriodId || null,
            grantedBy: sessionUser.id,
            grantedTo,
            actCode,
            observations,
            isActive: true,
            grantedAt: new Date()
        });
        // Fetch the permission with full relations
        const permissionWithRelations = yield index_1.GradeEditPermission.findByPk(permission.id, {
            include: [
                {
                    model: index_1.SchoolPeriod,
                    as: 'schoolPeriod'
                },
                {
                    model: index_1.User,
                    as: 'granter',
                    include: [{ model: index_1.Person, as: 'person' }]
                },
                {
                    model: index_1.User,
                    as: 'recipient',
                    include: [{ model: index_1.Person, as: 'person' }]
                }
            ]
        });
        res.status(201).json(permissionWithRelations);
    }
    catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({ message: 'Error al crear permiso', error: error.message });
    }
});
exports.createPermission = createPermission;
const getPermissions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        // Only Master and Administrador can view all permissions
        if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
            return res.status(403).json({ message: 'Solo Master y Administrador pueden ver permisos' });
        }
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        const baseInclude = [
            { model: index_1.SchoolPeriod, as: 'schoolPeriod' },
            { model: index_1.User, as: 'granter', include: [{ model: index_1.Person, as: 'person' }] },
            { model: index_1.User, as: 'recipient', include: [{ model: index_1.Person, as: 'person' }] },
            { model: index_1.User, as: 'revoker', include: [{ model: index_1.Person, as: 'person' }] },
        ];
        if (!pagination.isPaginated) {
            const permissions = yield index_1.GradeEditPermission.findAll({
                include: baseInclude,
                order: [['grantedAt', 'DESC']],
            });
            return res.json(permissions);
        }
        // Paginated: IDs first, then hydrate.
        const idRows = yield index_1.GradeEditPermission.findAll({
            include: baseInclude,
            attributes: ['id'],
            order: [['grantedAt', 'DESC']],
            limit: pagination.limit,
            offset: pagination.offset,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        const total = yield index_1.GradeEditPermission.count({
            include: baseInclude,
            distinct: true,
            col: 'id',
        });
        let permissions = [];
        if (ids.length > 0) {
            permissions = yield index_1.GradeEditPermission.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: baseInclude,
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('GradeEditPermission', 'id'), ids.map(String)))],
            });
        }
        return res.json((0, paginationService_1.buildPaginatedResponse)(permissions, total, pagination));
    }
    catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ message: 'Error al obtener permisos' });
    }
});
exports.getPermissions = getPermissions;
const revokePermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        // Only Master and Administrador can revoke permissions
        if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
            return res.status(403).json({ message: 'Solo Master y Administrador pueden revocar permisos' });
        }
        const { id } = req.params;
        const permission = yield index_1.GradeEditPermission.findByPk(id);
        if (!permission) {
            return res.status(404).json({ message: 'Permiso no encontrado' });
        }
        if (!permission.isActive) {
            return res.status(400).json({ message: 'El permiso ya está revocado' });
        }
        yield permission.update({
            isActive: false,
            revokedAt: new Date(),
            revokedBy: sessionUser.id
        });
        res.json({ message: 'Permiso revocado correctamente' });
    }
    catch (error) {
        console.error('Error revoking permission:', error);
        res.status(500).json({ message: 'Error al revocar permiso' });
    }
});
exports.revokePermission = revokePermission;
const checkPermission = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        const { schoolPeriodId } = req.params;
        const parsedPeriodId = Number(schoolPeriodId);
        // Check if user has Control de Estudios role
        if (!hasRole(sessionUser, ['Control de Estudios', 'Master', 'Administrador'])) {
            return res.json({ hasPermission: false, reason: 'Usuario no tiene rol Control de Estudios' });
        }
        // BYPASS TEMPORAL DE PERMISOS DE EDICIÓN DE NOTAS
        // ------------------------------------------------------------
        // La verificación de permisos individuales está desactivada temporalmente.
        // Cualquier usuario con rol Control de Estudios, Master o Administrador
        // puede editar notas de períodos cerrados sin requerir un permiso explícito.
        //
        // Esto se mantiene mientras se diseña e implementa un sistema más robusto
        // para controlar los permisos de edición de notas (a futuro: sistema de
        // permisos granular por período/usuario/acción con aprobación multi-nivel).
        //
        // El código de verificación original (búsqueda de GradeEditPermission
        // global y específico por período) permanece más abajo como referencia.
        //
        // TODO: Re-enable permission checks once the new permission system is implemented.
        return res.json({ hasPermission: true, permission: { id: 0 }, scope: 'bypass' });
        // Check for global permission (schoolPeriodId is null)
        const globalPermission = yield index_1.GradeEditPermission.findOne({
            where: {
                grantedTo: sessionUser.id,
                schoolPeriodId: null,
                isActive: true
            }
        });
        if (globalPermission) {
            return res.json({ hasPermission: true, permission: globalPermission, scope: 'global' });
        }
        // Check for specific period permission
        const specificPermission = yield index_1.GradeEditPermission.findOne({
            where: {
                grantedTo: sessionUser.id,
                schoolPeriodId: parsedPeriodId,
                isActive: true
            },
            include: [
                {
                    model: index_1.SchoolPeriod,
                    as: 'schoolPeriod'
                }
            ]
        });
        if (specificPermission) {
            return res.json({ hasPermission: true, permission: specificPermission, scope: 'specific' });
        }
        res.json({ hasPermission: false, reason: 'No hay permiso activo para este período' });
    }
    catch (error) {
        console.error('Error checking permission:', error);
        res.status(500).json({ message: 'Error al verificar permiso' });
    }
});
exports.checkPermission = checkPermission;
const getAuditLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        // Only Master and Administrador can view audit log
        if (!hasRole(sessionUser, ['Master', 'Administrador'])) {
            console.log('[getAuditLog] User does not have required role');
            return res.status(403).json({ message: 'Solo Master y Administrador pueden ver el historial de auditoría' });
        }
        const { limit = 100, offset = 0 } = req.query;
        const audits = yield index_1.GradeEditAudit.findAll({
            include: [
                {
                    model: index_1.SubjectFinalGrade,
                    as: 'subjectFinalGrade',
                    include: [
                        {
                            model: index_1.InscriptionSubject,
                            as: 'inscriptionSubject',
                            include: [
                                {
                                    model: index_1.Subject,
                                    as: 'subject'
                                },
                                {
                                    model: index_1.Inscription,
                                    as: 'inscription',
                                    include: [
                                        {
                                            model: index_1.Person,
                                            as: 'student'
                                        },
                                        {
                                            model: index_1.SchoolPeriod,
                                            as: 'period'
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                },
                {
                    model: index_1.GradeEditPermission,
                    as: 'permission',
                    include: [
                        {
                            model: index_1.User,
                            as: 'granter',
                            include: [{ model: index_1.Person, as: 'person' }]
                        },
                        {
                            model: index_1.SchoolPeriod,
                            as: 'schoolPeriod'
                        }
                    ]
                },
                {
                    model: index_1.User,
                    as: 'editor',
                    include: [{ model: index_1.Person, as: 'person' }]
                }
            ],
            order: [['editedAt', 'DESC']],
            limit: Number(limit),
            offset: Number(offset)
        });
        res.json(audits);
    }
    catch (error) {
        console.error('Error fetching audit log:', error);
        res.status(500).json({ message: 'Error al obtener historial de auditoría' });
    }
});
exports.getAuditLog = getAuditLog;
/**
 * GET /api/grade-edit-permissions/unified-audit
 * Unified audit log from GradeChangeLog — covers all grade types.
 * Only Master and Administrador can access.
 * Filters: entityType, gradeType, editedBy, dateFrom, dateTo
 */
const getUnifiedAuditLog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const sessionUser = req.session.user;
        if (!sessionUser) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        if (!hasRole(sessionUser, ['Master', 'Administrador', 'Control de Estudios'])) {
            return res.status(403).json({ message: 'Solo Master, Administrador y Control de Estudios pueden ver el historial de auditoría' });
        }
        const { entityType, gradeType, editedBy, dateFrom, dateTo, limit = 200, offset = 0 } = req.query;
        const where = {};
        if (entityType && typeof entityType === 'string')
            where.entityType = entityType;
        if (gradeType && typeof gradeType === 'string')
            where.gradeType = gradeType;
        if (editedBy && !isNaN(Number(editedBy)))
            where.editedBy = Number(editedBy);
        if (dateFrom || dateTo) {
            where.editedAt = {};
            if (dateFrom)
                where.editedAt[sequelize_1.Op.gte] = new Date(String(dateFrom));
            if (dateTo)
                where.editedAt[sequelize_1.Op.lte] = new Date(String(dateTo) + 'T23:59:59');
        }
        const logs = yield index_1.GradeChangeLog.findAll({
            where,
            include: [
                { model: index_1.User, as: 'editor', include: [{ model: index_1.Person, as: 'person' }] },
            ],
            order: [['editedAt', 'DESC']],
            limit: Number(limit),
            offset: Number(offset),
        });
        res.json(logs);
    }
    catch (error) {
        console.error('[getUnifiedAuditLog] Error:', error);
        res.status(500).json({ message: 'Error al obtener auditoría unificada' });
    }
});
exports.getUnifiedAuditLog = getUnifiedAuditLog;
