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
exports.getMyStudents = exports.createGuardian = exports.searchGuardian = void 0;
const guardianProfileService_1 = require("../services/guardianProfileService.js");
const index_1 = require("../models/index.js");
const searchGuardian = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { documentType, document } = req.query;
        if (!documentType || !document) {
            return res.status(400).json({ error: 'documentType y document son obligatorios' });
        }
        const normalizedDoc = document.trim();
        const typeValue = documentType;
        // 1. Search for existing profile or person
        const found = yield (0, guardianProfileService_1.findGuardianProfile)(typeValue, normalizedDoc);
        if (found) {
            // 2. Ensure a real GuardianProfile record exists.
            // If 'found' came from Person table, 'found.id' is Person.id, which is WRONG for GuardianProfile.
            // We must find or create the actual GuardianProfile record to return the correct GuardianProfile.id.
            const realProfile = yield (0, guardianProfileService_1.findOrCreateGuardianProfile)({
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
    }
    catch (error) {
        console.error('Error searching guardian:', error);
        return res.status(500).json({ error: 'Error buscando representante' });
    }
});
exports.searchGuardian = searchGuardian;
const createGuardian = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, documentType, document, phone, phone2, whatsapp, email, residenceState, residenceMunicipality, residenceParish, address } = req.body || {};
        // Validate required fields
        if (!firstName || !lastName || !documentType || !document) {
            return res.status(400).json({ error: 'Datos básicos son obligatorios (Nombres, Apellidos, Documento)' });
        }
        const normalizedDoc = document.trim();
        const typeValue = documentType;
        const created = yield (0, guardianProfileService_1.findOrCreateGuardianProfile)({
            firstName,
            lastName,
            document: normalizedDoc,
            documentType: typeValue,
            phone,
            phone2,
            whatsapp,
            email,
            residenceState,
            residenceMunicipality,
            residenceParish,
            address,
            // Add other fields if needed, e.g. occupation
            occupation: req.body.occupation
        });
        return res.status(201).json(created);
    }
    catch (error) {
        console.error('Error creating guardian:', error);
        return res.status(500).json({ error: 'Error creando representante' });
    }
});
exports.createGuardian = createGuardian;
const getMyStudents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentUser = req.session.user;
        if (!currentUser || !currentUser.id) {
            return res.status(401).json({ message: 'No autorizado' });
        }
        // 1. Get the Person record for the logged-in user
        const person = yield index_1.Person.findOne({ where: { userId: currentUser.id } });
        if (!person) {
            return res.status(404).json({ message: 'Perfil de persona no encontrado para este usuario' });
        }
        // 2. Find the GuardianProfile matching this person's document
        // Note: In the future we might want a direct link, but for now we match by document
        const guardianProfile = yield index_1.GuardianProfile.findOne({
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
        const studentGuardians = yield index_1.StudentGuardian.findAll({
            where: { guardianId: guardianProfile.id },
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    include: [
                        {
                            model: index_1.Inscription,
                            as: 'inscriptions',
                            required: false,
                            limit: 1,
                            order: [['createdAt', 'DESC']], // Get latest inscription
                            include: [
                                { model: index_1.Grade, as: 'grade' },
                                { model: index_1.Section, as: 'section' },
                                { model: index_1.SchoolPeriod, as: 'period' }
                            ]
                        }
                    ]
                }
            ]
        });
        // 4. Format the response
        const students = studentGuardians.map(sg => {
            var _a, _b, _c;
            const student = sg.student;
            if (!student)
                return null;
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
                    grade: (_a = latestInscription.grade) === null || _a === void 0 ? void 0 : _a.name,
                    section: (_b = latestInscription.section) === null || _b === void 0 ? void 0 : _b.name,
                    period: (_c = latestInscription.period) === null || _c === void 0 ? void 0 : _c.name,
                    status: 'Inscrito' // You might want to derive this from actual status if available
                } : null
            };
        }).filter(s => s !== null);
        res.json(students);
    }
    catch (error) {
        console.error('Error fetching represented students:', error);
        res.status(500).json({ message: 'Error al obtener estudiantes representados' });
    }
});
exports.getMyStudents = getMyStudents;
