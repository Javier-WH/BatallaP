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
exports.upsertResidenceByPerson = exports.getResidenceByPerson = void 0;
const index_1 = require("../models/index.js");
const REQUIRED_FIELDS = [
    'birthState',
    'birthMunicipality',
    'birthParish',
    'residenceState',
    'residenceMunicipality',
    'residenceParish'
];
const validateBody = (body) => {
    const missing = REQUIRED_FIELDS.filter((field) => !body[field]);
    return {
        isValid: missing.length === 0,
        missing
    };
};
const ensureStudentRole = (roles) => {
    if (!roles || roles.length === 0)
        return false;
    return roles.some((role) => role.name === 'Alumno');
};
const getResidenceByPerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { personId } = req.params;
        const residence = yield index_1.PersonResidence.findOne({
            where: { personId }
        });
        if (!residence) {
            return res.status(404).json({ message: 'Residencia no registrada para esta persona' });
        }
        res.json(residence);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener la residencia' });
    }
});
exports.getResidenceByPerson = getResidenceByPerson;
const upsertResidenceByPerson = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { personId } = req.params;
        const validation = validateBody(req.body);
        if (!validation.isValid) {
            return res.status(400).json({
                message: 'Todos los campos son obligatorios',
                missing: validation.missing
            });
        }
        const person = yield index_1.Person.findByPk(personId, {
            include: [{ model: index_1.Role, as: 'roles', through: { attributes: [] } }]
        });
        if (!person) {
            return res.status(404).json({ message: 'Persona no encontrada' });
        }
        if (!ensureStudentRole(person.roles)) {
            return res.status(400).json({ message: 'Solo se permite registrar residencia para estudiantes' });
        }
        const [residence, created] = yield index_1.PersonResidence.findOrCreate({
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
            yield residence.update({
                birthState: req.body.birthState,
                birthMunicipality: req.body.birthMunicipality,
                birthParish: req.body.birthParish,
                residenceState: req.body.residenceState,
                residenceMunicipality: req.body.residenceMunicipality,
                residenceParish: req.body.residenceParish
            });
        }
        res.status(created ? 201 : 200).json(residence);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al registrar la residencia' });
    }
});
exports.upsertResidenceByPerson = upsertResidenceByPerson;
