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
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const studentGuardianService_1 = require("../services/studentGuardianService.js");
const FEMALE_NAMES = ['Mariana', 'Daniela', 'Gabriela', 'Luisa', 'Patricia', 'Valentina', 'Alejandra', 'Carolina'];
const MALE_NAMES = ['Carlos', 'Jorge', 'Luis', 'Diego', 'Andrés', 'Juan', 'Mateo', 'Sebastián'];
const LAST_NAMES = ['Pérez', 'González', 'Rodríguez', 'Fernández', 'Sánchez', 'Ramírez', 'Castro', 'Romero'];
const LOCATION_PRESETS = [
    {
        birth: { state: 'Distrito Capital', municipality: 'Libertador', parish: 'San Pedro' },
        residence: {
            state: 'Miranda',
            municipality: 'Sucre',
            parish: 'Petare',
            address: 'Av. Francisco de Miranda, Res. Horizonte'
        }
    },
    {
        birth: { state: 'Aragua', municipality: 'Girardot', parish: 'Las Delicias' },
        residence: {
            state: 'Carabobo',
            municipality: 'Valencia',
            parish: 'San José',
            address: 'Urb. La Viña, Calle 110, Casa 23'
        }
    },
    {
        birth: { state: 'Zulia', municipality: 'Maracaibo', parish: 'Olegario Villalobos' },
        residence: {
            state: 'Lara',
            municipality: 'Iribarren',
            parish: 'Concepción',
            address: 'Av. Lara, Residencias La Colina'
        }
    },
    {
        birth: { state: 'Miranda', municipality: 'Chacao', parish: 'Chacao' },
        residence: {
            state: 'Distrito Capital',
            municipality: 'Libertador',
            parish: 'El Paraíso',
            address: 'Res. Vista Verde, Torre B, Apto 8'
        }
    }
];
const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
const randomDigits = (length) => Math.floor(Math.random() * 10 ** length).toString().padStart(length, '0');
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/gi, '').toLowerCase();
const buildDocumentNumber = (base, suffix) => suffix === undefined ? base.toString() : `${base}${suffix}`;
const buildGuardianPayload = (firstName, lastName, documentNumber, location) => ({
    firstName,
    lastName,
    documentType: 'Venezolano',
    document: documentNumber,
    phone: `04${Math.random() > 0.5 ? '12' : '24'}${randomDigits(7)}`,
    email: `${slugify(firstName)}.${slugify(lastName)}.${randomDigits(3)}@representantes.demo`,
    residenceState: location.state,
    residenceMunicipality: location.municipality,
    residenceParish: location.parish,
    address: location.address
});
const parseArgs = () => {
    const countArg = process.argv.find(arg => arg.startsWith('--count='));
    const count = countArg ? parseInt(countArg.split('=')[1], 10) : 40;
    return Number.isNaN(count) ? 40 : Math.max(1, count);
};
const buildGradeStructure = (schoolPeriodId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const map = new Map();
    const periodGrades = yield index_1.PeriodGrade.findAll({ where: { schoolPeriodId }, transaction });
    for (const pg of periodGrades) {
        const periodSections = yield index_1.PeriodGradeSection.findAll({ where: { periodGradeId: pg.id }, transaction });
        const periodSubjects = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id },
            include: [{ model: index_1.Subject, as: 'subject', attributes: ['id', 'subjectGroupId'] }],
            transaction
        });
        const groupedSubjectIds = {};
        const mandatorySubjectIds = [];
        map.set(pg.gradeId, {
            sectionIds: periodSections.map(ps => ps.sectionId),
            mandatorySubjectIds,
            groupedSubjectIds
        });
        const structure = map.get(pg.gradeId);
        for (const ps of periodSubjects) {
            const subjectId = ps.subjectId;
            const groupId = (_b = (_a = ps.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) !== null && _b !== void 0 ? _b : null;
            if (!groupId) {
                structure.mandatorySubjectIds.push(subjectId);
                continue;
            }
            if (!structure.groupedSubjectIds[groupId]) {
                structure.groupedSubjectIds[groupId] = [];
            }
            structure.groupedSubjectIds[groupId].push(subjectId);
        }
    }
    return map;
});
const seedInscriptions = (targetCount) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    const transaction = yield database_1.default.transaction();
    try {
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' }, transaction });
        if (!activePeriod) {
            throw new Error('No existe un período escolar activo. Ejecute el seeder principal primero.');
        }
        const grades = yield index_1.Grade.findAll({ order: [['order', 'ASC']], transaction });
        if (grades.length === 0) {
            throw new Error('No se encontraron grados. Ejecute el seeder principal primero.');
        }
        const sections = yield index_1.Section.findAll({ order: [['createdAt', 'ASC']], transaction });
        if (sections.length === 0) {
            throw new Error('No existen secciones base. Ejecute el seeder de estructura académica.');
        }
        const gradeStructure = yield buildGradeStructure(activePeriod.id, transaction);
        if (gradeStructure.size === 0) {
            throw new Error('No existe estructura académica (PeriodGrade / materias / secciones). Ejecute academicStructureSeeder primero.');
        }
        const [studentRole] = yield index_1.Role.findOrCreate({
            where: { name: 'Alumno' },
            defaults: { name: 'Alumno' },
            transaction
        });
        let created = 0;
        let attempts = 0;
        while (created < targetCount && attempts < targetCount * 5) {
            attempts += 1;
            const baseDocumentNumber = 30000000 + attempts;
            const studentDocument = buildDocumentNumber(baseDocumentNumber);
            const existing = yield index_1.Person.findOne({ where: { document: studentDocument }, transaction });
            if (existing) {
                continue;
            }
            const isMale = Math.random() > 0.5;
            const firstName = isMale ? randomItem(MALE_NAMES) : randomItem(FEMALE_NAMES);
            const lastName = `${randomItem(LAST_NAMES)} ${randomItem(LAST_NAMES)}`;
            const gender = isMale ? 'M' : 'F';
            const birthYear = 2008 + (attempts % 5);
            const birthdate = new Date(birthYear, attempts % 12, (attempts % 28) + 1);
            const locationPreset = LOCATION_PRESETS[attempts % LOCATION_PRESETS.length];
            const residence = locationPreset.residence;
            const grade = grades[created % grades.length];
            const structure = gradeStructure.get(grade.id);
            const hasMandatorySubjects = (_a = structure === null || structure === void 0 ? void 0 : structure.mandatorySubjectIds.length) !== null && _a !== void 0 ? _a : 0;
            const hasGroupedSubjects = structure
                ? Object.values(structure.groupedSubjectIds).some(subjectList => subjectList.length > 0)
                : false;
            if (!structure ||
                structure.sectionIds.length === 0 ||
                (!hasMandatorySubjects && !hasGroupedSubjects)) {
                throw new Error(`El grado "${grade.name}" no tiene secciones o materias asignadas. Ejecute academicStructureSeeder antes de generar inscripciones.`);
            }
            const sectionId = structure.sectionIds[created % structure.sectionIds.length];
            const section = (_b = sections.find(sec => sec.id === sectionId)) !== null && _b !== void 0 ? _b : sections[created % sections.length];
            const person = yield index_1.Person.create({
                firstName,
                lastName,
                documentType: 'Venezolano',
                document: studentDocument,
                gender,
                birthdate,
                userId: null
            }, { transaction });
            yield index_1.PersonRole.create({ personId: person.id, roleId: studentRole.id }, { transaction });
            yield index_1.Contact.create({
                personId: person.id,
                phone1: `04${Math.random() > 0.5 ? '12' : '14'}${randomDigits(7)}`,
                email: `${slugify(firstName)}.${slugify(lastName.split(' ')[0])}${randomDigits(3)}@estudiantes.demo`,
                address: residence.address,
                whatsapp: `04${Math.random() > 0.5 ? '12' : '24'}${randomDigits(7)}`
            }, { transaction });
            yield index_1.PersonResidence.create({
                personId: person.id,
                birthState: locationPreset.birth.state,
                birthMunicipality: locationPreset.birth.municipality,
                birthParish: locationPreset.birth.parish,
                residenceState: residence.state,
                residenceMunicipality: residence.municipality,
                residenceParish: residence.parish
            }, { transaction });
            const motherPayload = buildGuardianPayload(randomItem(FEMALE_NAMES), lastName, buildDocumentNumber(baseDocumentNumber, 1), residence);
            const fatherPayload = buildGuardianPayload(randomItem(MALE_NAMES), lastName, buildDocumentNumber(baseDocumentNumber, 2), residence);
            const representativeType = Math.random();
            const motherIsRepresentative = representativeType < 0.4;
            const fatherIsRepresentative = !motherIsRepresentative && representativeType < 0.75;
            const hasExternalRepresentative = !motherIsRepresentative && !fatherIsRepresentative;
            const assignments = [
                {
                    payload: motherPayload,
                    relationship: 'mother',
                    isRepresentative: motherIsRepresentative
                },
                {
                    payload: fatherPayload,
                    relationship: 'father',
                    isRepresentative: fatherIsRepresentative
                }
            ];
            if (hasExternalRepresentative) {
                const repPayload = buildGuardianPayload(randomItem([...FEMALE_NAMES, ...MALE_NAMES]), randomItem(LAST_NAMES), buildDocumentNumber(baseDocumentNumber, 3), residence);
                assignments.push({
                    payload: repPayload,
                    relationship: 'representative',
                    isRepresentative: true
                });
            }
            yield (0, studentGuardianService_1.assignGuardians)(person.id, assignments, transaction);
            const inscription = yield index_1.Inscription.create({
                personId: person.id,
                schoolPeriodId: activePeriod.id,
                gradeId: grade.id,
                sectionId: (_c = section === null || section === void 0 ? void 0 : section.id) !== null && _c !== void 0 ? _c : undefined,
                escolaridad: 'regular'
            }, { transaction });
            const subjectIds = [...structure.mandatorySubjectIds];
            for (const groupedSubjects of Object.values(structure.groupedSubjectIds)) {
                if (groupedSubjects.length === 0) {
                    continue;
                }
                subjectIds.push(randomItem(groupedSubjects));
            }
            if (subjectIds.length > 0) {
                yield index_1.InscriptionSubject.bulkCreate(subjectIds.map(subjectId => ({
                    inscriptionId: inscription.id,
                    subjectId
                })), { transaction });
            }
            created += 1;
        }
        yield transaction.commit();
        console.log(`✅ Se generaron ${created} inscripciones completas con representantes y materias.`);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('❌ Error generando inscripciones masivas:', error);
        throw error;
    }
});
if (require.main === module) {
    const count = parseArgs();
    database_1.default.authenticate()
        .then(() => seedInscriptions(count))
        .then(() => process.exit(0))
        .catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
exports.default = seedInscriptions;
