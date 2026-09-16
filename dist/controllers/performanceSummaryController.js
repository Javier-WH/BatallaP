"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.setGroupSigner = exports.getGroupTeachers = exports.getTituloData = exports.getGeneralAverages = exports.getBoletinData = exports.exportRevisionSummary = exports.exportPerformanceSummary = void 0;
const sequelize_1 = require("sequelize");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const exceljs_1 = __importDefault(require("exceljs"));
const index_1 = require("../models/index.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const subjectGroupService_1 = require("../services/subjectGroupService.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const gradeCalculationService_1 = require("../services/gradeCalculationService.js");
const templateNamedRanges_1 = require("../services/templateNamedRanges.js");
const studentSortService_1 = require("../services/studentSortService.js");
const councilDateResolver_1 = require("../services/councilDateResolver.js");
const gradeOrderToSheetName = {
    1: '1er Año',
    2: '1er Año',
    3: '3er Año',
    4: '4to Año',
    5: '5to Año',
};
const stateAbbreviations = {
    'GUARICO': 'GU',
    'MIRANDA': 'MI',
    'CARABOBO': 'CA',
    'ZULIA': 'ZU',
    'ARAGUA': 'AR',
    'BARINAS': 'BA',
    'BOLIVAR': 'BO',
    'COJEDES': 'CO',
    'PORTUGUESA': 'PO',
    'LARA': 'LA',
    'YARACUY': 'YA',
    'FALCON': 'FA',
    'VARGAS': 'VA',
    'MERIDA': 'ME',
    'TRUJILLO': 'TR',
    'TACHIRA': 'TA',
    'APURE': 'AP',
    'GUAIRA': 'GU',
    'NUEVA ESPARTA': 'NE',
    'SUCRE': 'SU',
    'ANZOATEGUI': 'AN',
    'MONAGAS': 'MO',
    'DELTA AMACURO': 'DA',
    'AMAZONAS': 'AM',
    'DISTRITO CAPITAL': 'DC',
    'DEPENDENCIAS FEDERALES': 'DF',
};
function getStateAbbrev(stateName) {
    if (!stateName)
        return '';
    const upper = stateName.toUpperCase().trim();
    return stateAbbreviations[upper] || upper.substring(0, 2);
}
function padNumber(n) {
    if (n == null)
        return null;
    if (n < 0)
        return n;
    if (n < 10)
        return '0' + n;
    return n;
}
function numericToLetter(numericGrade, letterGrades) {
    if (!letterGrades || letterGrades.length === 0)
        return String(numericGrade);
    const sorted = [...letterGrades].sort((a, b) => b.max - a.max);
    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];
        if (!next)
            return numericGrade <= current.max ? current.letter : String(numericGrade);
        if (numericGrade > next.max && numericGrade <= current.max)
            return current.letter;
    }
    return String(numericGrade);
}
function filterHistoricalGradesByCurrentPlantel(rows) {
    return __awaiter(this, void 0, void 0, function* () {
        const personIds = [...new Set(rows.map(row => row.personId).filter(Boolean))];
        if (personIds.length === 0)
            return [];
        const personPlanteles = yield index_1.PersonPlantel.findAll({
            where: { personId: personIds },
            order: [['order', 'ASC']],
        });
        const latestByPerson = new Map();
        for (const plantel of personPlanteles) {
            const current = latestByPerson.get(plantel.personId);
            if (!current || Number(plantel.order) > Number(current.order)) {
                latestByPerson.set(plantel.personId, plantel);
            }
        }
        // If no plantel mapping exists, preserve legacy historical rows. Once a
        // mapping exists, the note must belong to that person's current institution.
        return rows.filter(row => {
            const current = latestByPerson.get(row.personId);
            if (!current)
                return true;
            if (current.isSystem)
                return row.plantelId == null;
            return row.plantelId != null && Number(row.plantelId) === Number(current.plantelId);
        });
    });
}
function getInstitutionSettings() {
    return __awaiter(this, void 0, void 0, function* () {
        const settings = yield index_1.Setting.findAll();
        const map = {};
        settings.forEach((s) => { map[s.key] = s.value; });
        return map;
    });
}
const MAX_STUDENTS_PER_SHEET = 35;
function cloneWorksheet(workbook, sourceSheet, newName) {
    const newSheet = workbook.addWorksheet(newName, {
        properties: sourceSheet.model.properties,
        views: sourceSheet.model.views,
    });
    // Copy column widths
    if (sourceSheet.columns) {
        sourceSheet.columns.forEach((col, idx) => {
            if (col && col.width != null) {
                newSheet.getColumn(idx + 1).width = col.width;
            }
        });
    }
    // Copy cell values, styles and row heights
    sourceSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const newCell = newSheet.getRow(rowNum).getCell(colNumber);
            newCell.value = cell.value;
            if (cell.style) {
                newCell.style = JSON.parse(JSON.stringify(cell.style));
            }
            if (cell.numFmt) {
                newCell.numFmt = cell.numFmt;
            }
            if (cell.font) {
                newCell.font = JSON.parse(JSON.stringify(cell.font));
            }
            if (cell.alignment) {
                newCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
            }
            if (cell.border) {
                newCell.border = JSON.parse(JSON.stringify(cell.border));
            }
            if (cell.fill) {
                newCell.fill = JSON.parse(JSON.stringify(cell.fill));
            }
        });
        if (row.height != null) {
            newSheet.getRow(rowNum).height = row.height;
        }
    });
    // Copy merged cell ranges
    if (sourceSheet.model.merges) {
        sourceSheet.model.merges.forEach((merge) => {
            newSheet.mergeCells(merge);
        });
    }
    // Copy page setup and print options if present
    if (sourceSheet.pageSetup) {
        newSheet.pageSetup = JSON.parse(JSON.stringify(sourceSheet.pageSetup));
    }
    return newSheet;
}
function fillSheetByNamedRanges(sheet, sheetName, namedRanges, settings, plantel, period, students, academicSubjects, groupedSubjectIds, subjectColList, subjectToSubjIndex, calculateFinalScore, subjectOrderMap, studentOffset, sourceSheetName, gradeName, sectionName, letterGradesConfig, lastCouncilDate, isMpSection, isRevisionSection, isAbsentFn, pendingExcludedPersonIds) {
    var _a, _b, _c;
    // Only writes when value is non-empty. Empty/undefined values leave the
    // cell untouched, preserving the template's decorative content (e.g. "***"
    // placeholders) for unused student rows.
    // For cloned pages (e.g. "1er Año (Regulares 2)"), the named ranges are
    // registered for the original sheet (e.g. "1er Año"), so we look up
    // coordinates by the original sheet's name and write to the same absolute
    // coordinates in the destination sheet.
    const lookupSheetName = sourceSheetName || sheetName;
    // Map of Venezuelan states with correct accents (uppercase)
    const STATE_ACCENTS = {
        'GUARICO': 'GUÁRICO',
        'AMAZONAS': 'AMAZONAS',
        'ANZOATEGUI': 'ANZOÁTEGUI',
        'APURE': 'APURE',
        'ARAGUA': 'ARAGUA',
        'BARINAS': 'BARINAS',
        'BOLIVAR': 'BOLÍVAR',
        'CARABOBO': 'CARABOBO',
        'COJEDES': 'COJEDES',
        'DELTA AMACURO': 'DELTA AMACURO',
        'FALCON': 'FALCÓN',
        'GUAYANA': 'GUAYANA',
        'LARA': 'LARA',
        'MERIDA': 'MÉRIDA',
        'MIRANDA': 'MIRANDA',
        'MONAGAS': 'MONAGAS',
        'NUEVA ESPARTA': 'NUEVA ESPARTA',
        'PORTUGUESA': 'PORTUGUESA',
        'SUCRE': 'SUCRE',
        'TACHIRA': 'TÁCHIRA',
        'TRUJILLO': 'TRUJILLO',
        'VARGAS': 'VARGAS',
        'YARACUY': 'YARACUY',
        'ZULIA': 'ZULIA',
        'DISTRITO CAPITAL': 'DISTRITO CAPITAL',
        'DEPENDENCIAS FEDERALES': 'DEPENDENCIAS FEDERALES',
    };
    const fixAccents = (name, value) => {
        if (name === 'inst_state') {
            const upper = value.toUpperCase();
            return STATE_ACCENTS[upper] || upper;
        }
        return value;
    };
    const setByRange = (name, value) => {
        if (value === undefined || value === null || value === '')
            return;
        if (typeof value === 'string') {
            value = value.toUpperCase();
            value = fixAccents(name, value);
        }
        let ref = namedRanges.getCell(lookupSheetName, name);
        if (!ref) {
            for (const sn of namedRanges.bySheet.keys()) {
                ref = namedRanges.getCell(sn, name);
                if (ref)
                    break;
            }
        }
        if (ref) {
            sheet.getCell(ref.cell).value = value;
        }
    };
    setByRange('inst_period', period === null || period === void 0 ? void 0 : period.name);
    setByRange('inst_code', settings.institution_dea_code || (plantel === null || plantel === void 0 ? void 0 : plantel.code));
    setByRange('inst_education_code', settings.institution_code);
    setByRange('inst_level', settings.institution_level);
    setByRange('inst_name', settings.institution_name || (plantel === null || plantel === void 0 ? void 0 : plantel.name));
    setByRange('inst_address', settings.institution_address);
    setByRange('inst_phone', settings.institution_phone);
    setByRange('inst_municipality', settings.institution_municipality || (plantel === null || plantel === void 0 ? void 0 : plantel.municipality));
    setByRange('inst_state', settings.institution_state || (plantel === null || plantel === void 0 ? void 0 : plantel.state));
    setByRange('inst_cdcee', settings.institution_cdcee);
    setByRange('inst_director', settings.director_name);
    setByRange('inst_director_doc', settings.director_document);
    // inst_director_2 uses "Apellidos, Nombres" format if available, else falls back to director_name
    const directorFirstNames = (settings.director_first_names || '').trim();
    const directorLastNames = (settings.director_last_names || '').trim();
    const directorLong = (directorLastNames && directorFirstNames)
        ? `${directorLastNames}, ${directorFirstNames}`
        : settings.director_name;
    setByRange('inst_director_2', directorLong);
    setByRange('inst_director_doc_2', settings.director_document);
    setByRange('inst_grade', gradeName);
    setByRange('inst_section', sectionName);
    // Write the council date to cell Z4 (no named range defined in template).
    // Format: "MES DE AÑO" (e.g. "JULIO DE 2026") in uppercase.
    if (lastCouncilDate) {
        const caracasDate = (0, councilDateResolver_1.formatDateInCaracas)(lastCouncilDate);
        if (caracasDate) {
            const parts = caracasDate.split('-');
            const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
            const dateStr = `${months[Number(parts[1]) - 1]} DE ${parts[0]}`;
            // Try named range first, fall back to direct Z4 cell
            let dateRef = namedRanges.getCell(lookupSheetName, 'inst_date');
            if (!dateRef) {
                for (const sn of namedRanges.bySheet.keys()) {
                    dateRef = namedRanges.getCell(sn, 'inst_date');
                    if (dateRef)
                        break;
                }
            }
            if (dateRef) {
                sheet.getCell(dateRef.cell).value = dateStr;
            }
            else {
                // Direct write to Z4 (hardcoded in template)
                sheet.getCell('Z4').value = dateStr;
            }
        }
    }
    for (let n = 1; n <= MAX_STUDENTS_PER_SHEET; n++) {
        const studentIdx = studentOffset + (n - 1);
        const ins = students[studentIdx];
        // If no student for this row, do nothing — keep the template's placeholder
        // (e.g. "***") intact.
        if (!ins)
            continue;
        const student = ins.student;
        const residence = student === null || student === void 0 ? void 0 : student.residence;
        setByRange('std_num_' + n, String(studentIdx + 1).padStart(2, '0'));
        const documentType = student === null || student === void 0 ? void 0 : student.documentType;
        // Stored documents may already contain a type prefix (e.g. V777777).
        // Remove it before applying the canonical export format.
        const document = String((student === null || student === void 0 ? void 0 : student.document) || '').replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
        const docType = documentType === 'Venezolano' ? 'V' :
            documentType === 'Extranjero' ? 'E' :
                documentType === 'Pasaporte' ? 'P' : '';
        setByRange('std_doc_' + n, docType ? `${docType} ${document}` : document);
        setByRange('std_ln_' + n, student === null || student === void 0 ? void 0 : student.lastName);
        setByRange('std_fn_' + n, student === null || student === void 0 ? void 0 : student.firstName);
        setByRange('std_bp_' + n, residence === null || residence === void 0 ? void 0 : residence.birthMunicipality);
        setByRange('std_ef_' + n, getStateAbbrev((residence === null || residence === void 0 ? void 0 : residence.birthState) || ''));
        setByRange('std_sx_' + n, student === null || student === void 0 ? void 0 : student.gender);
        if (student === null || student === void 0 ? void 0 : student.birthdate) {
            const birthDate = (0, councilDateResolver_1.formatDateOnly)(student.birthdate);
            if (birthDate) {
                const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
                setByRange('std_bd_' + n, padNumber(birthDay));
                setByRange('std_bm_' + n, padNumber(birthMonth));
                setByRange('std_by_' + n, padNumber(birthYear % 100));
            }
        }
        // For MP sections, use pendingSubjects; for regular, use inscriptionSubjects
        const insSubjects = isMpSection
            ? (ins.pendingSubjects || [])
            : (0, subjectOrderService_1.sortSubjectsByOrder)(ins.__groupAwareInscriptionSubjects || ins.inscriptionSubjects || [], (is) => is.subjectId, (is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name; }, subjectOrderMap);
        for (let i = 0; i < subjectColList.length; i++) {
            const subjId = subjectColList[i].subjectId;
            if (!subjId)
                continue;
            const columnSubject = academicSubjects.find((s) => s.id === subjId);
            const insSub = insSubjects.find((is) => {
                var _a;
                return is.subjectId === subjId || ((columnSubject === null || columnSubject === void 0 ? void 0 : columnSubject.subjectGroupId) !== null &&
                    (columnSubject === null || columnSubject === void 0 ? void 0 : columnSubject.subjectGroupId) !== undefined &&
                    ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === columnSubject.subjectGroupId);
            });
            const score = insSub ? calculateFinalScore(insSub) : null;
            const col = subjectColList[i].col;
            const row = 15 + n;
            // Students with unresolved pending subjects repeat the year — all their
            // grades are shown as "P" (Pendiente) instead of numeric scores.
            // Exception: the Materia Pendiente summary shows the real encounter
            // grades (or "I" for absences), never "P".
            if (!isMpSection && pendingExcludedPersonIds && pendingExcludedPersonIds.has(ins.personId)) {
                sheet.getRow(row).getCell(col).value = 'P';
                continue;
            }
            const isLiteral = (_b = (_a = insSub === null || insSub === void 0 ? void 0 : insSub.subject) === null || _a === void 0 ? void 0 : _a.usesLiteralGrades) !== null && _b !== void 0 ? _b : columnSubject === null || columnSubject === void 0 ? void 0 : columnSubject.usesLiteralGrades;
            // For MP sections, check if the student was absent (I) instead of showing 00.
            // The LAST encounter with information governs: if it was an absence -> "I".
            const mpIsAbsent = isMpSection && insSub ? (() => {
                const encs = (insSub.encounters || []).sort((a, b) => a.encounterNumber - b.encounterNumber);
                const lastScored = [...encs].reverse().find((e) => e.score !== null || e.isAbsent);
                return lastScored ? !!lastScored.isAbsent : false;
            })() : false;
            // For revision sections, check if the last scored revision was an absence
            const revIsAbsent = isRevisionSection && insSub && isAbsentFn ? isAbsentFn(insSub) : false;
            if ((isMpSection && mpIsAbsent) || (isRevisionSection && revIsAbsent)) {
                sheet.getRow(row).getCell(col).value = 'I';
            }
            else if (isLiteral) {
                if (score != null) {
                    sheet.getRow(row).getCell(col).value = numericToLetter(score, letterGradesConfig || []).toUpperCase();
                }
            }
            else if (score != null) {
                sheet.getRow(row).getCell(col).value = padNumber(score);
            }
        }
        if (!isMpSection) {
            // std_part_N represents the group subject taken in the LAST lapso.
            // The group-aware proxy is built from the per-term choice map above.
            const latestGroupSubjectName = ins.__latestGroupSubjectName;
            const groupedInsSub = insSubjects.find((is) => groupedSubjectIds.has(is.subjectId));
            const groupSubjectName = latestGroupSubjectName || ((_c = groupedInsSub === null || groupedInsSub === void 0 ? void 0 : groupedInsSub.subject) === null || _c === void 0 ? void 0 : _c.name);
            if (groupSubjectName) {
                setByRange('std_part_' + n, groupSubjectName);
            }
        }
    }
}
const exportPerformanceSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { schoolPeriodId, gradeId, sectionId, template } = req.query;
        // Validate the three required identifiers. They must be numeric strings
        // (positive integers) so the rest of the pipeline can safely Number()
        // them without producing NaN.
        const numericFields = [
            ['schoolPeriodId', schoolPeriodId],
            ['gradeId', gradeId],
            ['sectionId', sectionId],
        ];
        for (const [name, raw] of numericFields) {
            if (raw === undefined || raw === null || raw === '') {
                return res.status(400).json({ message: `${name} es requerido` });
            }
            const n = Number(raw);
            if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
                return res.status(400).json({ message: `${name} debe ser un número entero positivo` });
            }
        }
        const period = yield index_1.SchoolPeriod.findByPk(Number(schoolPeriodId));
        if (!period)
            return res.status(404).json({ message: 'Periodo no encontrado' });
        const grade = yield index_1.Grade.findByPk(Number(gradeId));
        if (!grade)
            return res.status(404).json({ message: 'Grado no encontrado' });
        const section = yield index_1.Section.findByPk(Number(sectionId));
        if (!section)
            return res.status(404).json({ message: 'Seccion no encontrada' });
        const isMpSection = section.name.toUpperCase() === 'MATERIA PENDIENTE';
        const gradeOrder = grade.order || 1;
        const gradeSuffix = gradeOrder === 1 || gradeOrder === 3 ? 'ER' : gradeOrder === 2 ? 'DO' : 'TO';
        const templateGradeName = `${gradeOrder}${gradeSuffix} AÑO`;
        const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';
        const pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
        });
        const historicalMode = !pg;
        const requestedHistoricalType = String(req.query.historicalGradeType || '');
        const historicalGradeTypes = requestedHistoricalType === 'revision'
            ? ['revision']
            : isMpSection
                ? ['materia_pendiente', 'revision_materia_pendiente']
                : ['regular'];
        let historicalRows = historicalMode
            ? yield index_1.HistoricalGrade.findAll({
                where: {
                    schoolPeriodId: Number(schoolPeriodId),
                    gradeId: Number(gradeId),
                    gradeType: { [sequelize_1.Op.in]: historicalGradeTypes },
                },
                include: [{ model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] }],
                order: [['subjectId', 'ASC']],
            })
            : [];
        if (historicalMode) {
            historicalRows = yield filterHistoricalGradesByCurrentPlantel(historicalRows);
        }
        if (!pg && !historicalMode)
            return res.status(404).json({ message: 'Estructura académica no encontrada' });
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId: Number(schoolPeriodId) },
            raw: true,
        });
        const termCount = terms.length || 1;
        // Query CouncilChecklist to know which (termId, sectionId) pairs have council done
        const councilChecklists = yield index_1.CouncilChecklist.findAll({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                gradeId: Number(gradeId),
                status: 'done',
                termId: terms.map((t) => t.id),
                sectionId: Number(sectionId),
            },
            attributes: ['termId', 'sectionId', 'status', 'completedAt'],
        });
        // Find the most recent council completion date for this section
        const councilDates = councilChecklists
            .filter((c) => c.completedAt)
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
        let lastCouncilDate = councilDates.length > 0 ? String(councilDates[0].completedAt) : null;
        // For MP sections, use the date of the last encounter with a score
        // (instead of the council completion date) for inst_date.
        if (isMpSection && !historicalMode) {
            const lastEncounter = yield index_1.PendingSubjectEncounter.findOne({
                where: { score: { [sequelize_1.Op.ne]: null } },
                order: [['date', 'DESC']],
                raw: true,
            });
            if (lastEncounter === null || lastEncounter === void 0 ? void 0 : lastEncounter.date) {
                lastCouncilDate = String(lastEncounter.date);
            }
        }
        const isCouncilDone = gradeCalculationService_1.GradeCalculationService.buildCouncilDoneChecker(councilChecklists.map((c) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })));
        const settings = yield getInstitutionSettings();
        const letterGradesConfig = (() => {
            try {
                const raw = settings.letter_grades;
                if (!raw)
                    return [];
                const parsed = JSON.parse(raw);
                return parsed.scale || parsed || [];
            }
            catch (_a) {
                return [];
            }
        })();
        let plantel = null;
        if (settings.institution_dea_code) {
            plantel = yield index_1.Plantel.findOne({ where: { code: settings.institution_dea_code } });
        }
        let inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                sectionId: Number(sectionId),
                gradeId: Number(gradeId),
            },
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    include: [
                        { model: index_1.PersonResidence, as: 'residence' },
                    ],
                },
                ...(isMpSection && !historicalMode ? [] : [{
                        model: index_1.InscriptionSubject,
                        as: 'inscriptionSubjects',
                        include: [
                            { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                            { model: index_1.SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false },
                            { model: index_1.SubjectTermGrade, as: 'termGrades', required: false },
                            { model: index_1.Qualification, as: 'qualifications', include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }], required: false },
                            { model: index_1.CouncilPoint, as: 'councilPoints', required: false },
                        ],
                    }]),
                ...(isMpSection && !historicalMode ? [{
                        model: index_1.PendingSubject,
                        as: 'pendingSubjects',
                        required: true,
                        include: [
                            { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                            { model: index_1.PendingSubjectEncounter, as: 'encounters', required: false },
                        ],
                    }] : []),
            ],
            order: [
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        if (inscriptions.length === 0 && historicalMode) {
            const currentPeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
            const historicalPersonIds = [...new Set(historicalRows.map(row => row.personId))];
            if (currentPeriod && currentPeriod.id !== Number(schoolPeriodId) && historicalPersonIds.length > 0) {
                const currentInscriptions = yield index_1.Inscription.findAll({
                    where: { schoolPeriodId: currentPeriod.id, personId: historicalPersonIds },
                    include: [
                        { model: index_1.Person, as: 'student', include: [{ model: index_1.PersonResidence, as: 'residence' }] },
                        { model: index_1.Section, as: 'section' },
                    ],
                });
                const requestedSectionName = section.name.trim().toUpperCase();
                inscriptions = currentInscriptions.filter((ins) => { var _a, _b; return ((_b = (_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.trim().toUpperCase()) === requestedSectionName; });
            }
        }
        if (inscriptions.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes inscritos en esta seccion' });
        }
        // Students with unresolved pending subjects (PendingSubject.status='pendiente'
        // in this school period) repeat the year — all their grades are exported
        // as "P" (Pendiente). PendingSubject links to the MP inscription, so we
        // match through the inscription association and exclude by personId.
        const pendingExcludedRows = yield index_1.PendingSubject.findAll({
            where: { status: 'pendiente' },
            attributes: ['id'],
            include: [{
                    model: index_1.Inscription,
                    as: 'inscription',
                    where: { schoolPeriodId: Number(schoolPeriodId) },
                    attributes: ['personId'],
                }],
        });
        const pendingExcludedPersonIds = new Set(pendingExcludedRows.map((p) => { var _a; return (_a = p.inscription) === null || _a === void 0 ? void 0 : _a.personId; }).filter((id) => typeof id === 'number'));
        if (historicalMode) {
            const historicalByPerson = new Map();
            for (const historical of historicalRows) {
                const rows = historicalByPerson.get(historical.personId) || [];
                rows.push({
                    id: `historical-${historical.id}`,
                    inscriptionId: null,
                    subjectId: historical.subjectId,
                    subject: historical.subject,
                    qualifications: [],
                    termGrades: [],
                    councilPoints: [],
                    finalGrade: {
                        finalScore: historical.finalScore,
                        status: historical.status,
                        gradeType: historical.gradeType,
                    },
                });
                historicalByPerson.set(historical.personId, rows);
            }
            inscriptions.forEach(ins => {
                ins.inscriptionSubjects = historicalByPerson.get(ins.personId) || [];
            });
        }
        // Load per-term group choices once. Historical InscriptionSubject rows are
        // intentionally preserved, so the annual report must select the correct row
        // independently for each term.
        if (!isMpSection) {
            const choices = yield index_1.InscriptionGroupTermChoice.findAll({
                where: {
                    inscriptionId: inscriptions.map(ins => ins.id),
                    termId: terms.map((t) => t.id),
                },
                attributes: ['inscriptionId', 'termId', 'subjectGroupId', 'subjectId'],
            });
            const choiceMap = new Map();
            choices.forEach(choice => choiceMap.set(`${choice.inscriptionId}:${choice.termId}:${choice.subjectGroupId}`, choice.subjectId));
            inscriptions.forEach(ins => {
                var _a;
                ins.__groupChoiceMap = choiceMap;
                const subjects = ins.inscriptionSubjects || [];
                const grouped = new Map();
                const coreSubjects = [];
                subjects.forEach((subject) => {
                    var _a;
                    const groupId = (_a = subject.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId;
                    if (groupId == null)
                        coreSubjects.push(subject);
                    else
                        grouped.set(groupId, [...(grouped.get(groupId) || []), subject]);
                });
                const groupAwareSubjects = [...coreSubjects];
                for (const [groupId, groupSubjects] of grouped) {
                    const latestTerm = [...terms].sort((a, b) => b.order - a.order)[0];
                    const latestChoiceId = latestTerm
                        ? choiceMap.get(`${ins.id}:${latestTerm.id}:${groupId}`)
                        : undefined;
                    const proxySource = groupSubjects.find(s => s.subjectId === latestChoiceId)
                        || groupSubjects[0];
                    const proxy = Object.assign(Object.assign({}, proxySource), { qualifications: [], termGrades: [], councilPoints: [] });
                    for (const currentTerm of terms) {
                        const selectedSubjectId = choiceMap.get(`${ins.id}:${currentTerm.id}:${groupId}`);
                        const selectedSubject = groupSubjects.find(s => s.subjectId === selectedSubjectId)
                            || groupSubjects.find(s => (s.qualifications || []).some((q) => { var _a; return ((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.termId) === currentTerm.id; }))
                            || proxySource;
                        proxy.qualifications.push(...(selectedSubject.qualifications || []).filter((q) => { var _a; return ((_a = q.evaluationPlan) === null || _a === void 0 ? void 0 : _a.termId) === currentTerm.id; }));
                        proxy.termGrades.push(...(selectedSubject.termGrades || []).filter((tg) => tg.termId === currentTerm.id));
                        proxy.councilPoints.push(...(selectedSubject.councilPoints || []).filter((cp) => cp.termId === currentTerm.id));
                    }
                    groupAwareSubjects.push(proxy);
                }
                ins.__groupAwareInscriptionSubjects = groupAwareSubjects;
                const latestGroupSubject = groupAwareSubjects.find((subject) => { var _a; return ((_a = subject.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) != null; });
                ins.__latestGroupSubjectName = ((_a = latestGroupSubject === null || latestGroupSubject === void 0 ? void 0 : latestGroupSubject.subject) === null || _a === void 0 ? void 0 : _a.name) || null;
            });
        }
        // Sort students canonically: document type priority → document number → lastName → firstName
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const fallbackPeriodGrade = !pg
            ? yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } }).then(current => current
                ? index_1.PeriodGrade.findOne({ where: { schoolPeriodId: current.id, gradeId: Number(gradeId) } })
                : null)
            : null;
        const subjectOrderMap = pg
            ? yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id)
            : fallbackPeriodGrade
                ? yield (0, subjectOrderService_1.getSubjectOrderMap)(fallbackPeriodGrade.id)
                : new Map();
        const subjectMap = new Map();
        if (isMpSection && !historicalMode) {
            // For MP section, build subjectMap from pendingSubjects (each student's
            // pending subjects with their subject info). Subjects flagged as
            // "No Reparable" are excluded — they cannot be in Materia Pendiente.
            const mpNotRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(Number(gradeId), Number(schoolPeriodId));
            inscriptions.forEach((ins) => {
                (ins.pendingSubjects || []).forEach((ps) => {
                    var _a, _b, _c;
                    if (mpNotRepairableMap.get(ps.subjectId) === true)
                        return;
                    if (ps.subject && !subjectMap.has(ps.subjectId)) {
                        subjectMap.set(ps.subjectId, {
                            id: ps.subject.id,
                            name: ps.subject.name,
                            abbreviation: ps.subject.abbreviation || null,
                            subjectGroupId: ps.subject.subjectGroupId || null,
                            subjectGroupName: ((_a = ps.subject.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || null,
                            subjectGroupShortAbbr: ((_b = ps.subject.subjectGroup) === null || _b === void 0 ? void 0 : _b.shortAbbreviation) || null,
                            subjectGroupLongAbbr: ((_c = ps.subject.subjectGroup) === null || _c === void 0 ? void 0 : _c.longAbbreviation) || null,
                            usesLiteralGrades: ps.subject.usesLiteralGrades || false,
                        });
                    }
                });
            });
        }
        else {
            inscriptions.forEach((ins) => {
                const sorted = (0, subjectOrderService_1.sortSubjectsByOrder)(ins.inscriptionSubjects || [], (is) => is.subjectId, (is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.name; }, subjectOrderMap);
                sorted.forEach((is) => {
                    var _a, _b, _c;
                    if (is.subject && !subjectMap.has(is.subjectId)) {
                        subjectMap.set(is.subjectId, {
                            id: is.subject.id,
                            name: is.subject.name,
                            abbreviation: is.subject.abbreviation || null,
                            subjectGroupId: is.subject.subjectGroupId || null,
                            subjectGroupName: ((_a = is.subject.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || null,
                            subjectGroupShortAbbr: ((_b = is.subject.subjectGroup) === null || _b === void 0 ? void 0 : _b.shortAbbreviation) || null,
                            subjectGroupLongAbbr: ((_c = is.subject.subjectGroup) === null || _c === void 0 ? void 0 : _c.longAbbreviation) || null,
                            usesLiteralGrades: is.subject.usesLiteralGrades || false,
                        });
                    }
                });
            });
        }
        // Also seed subjectMap from the grade's curriculum (PeriodGradeSubject) so
        // that subjects added to the grade appear in the Excel even if no student
        // has an InscriptionSubject for them yet.
        // For MP sections, we still query PeriodGradeSubject to know the canonical
        // order and positions, but we do NOT add them to subjectMap — only subjects
        // with actual PendingSubject records get written.
        const curriculumPeriodGrade = pg || fallbackPeriodGrade;
        const pgSubjects = curriculumPeriodGrade
            ? yield index_1.PeriodGradeSubject.findAll({
                where: { periodGradeId: curriculumPeriodGrade.id },
                include: [
                    { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                ],
            })
            : historicalRows.map((row) => ({ subjectId: row.subjectId, subject: row.subject }));
        if (!isMpSection) {
            for (const pgs of pgSubjects) {
                const subj = pgs.subject;
                if (subj && !subjectMap.has(subj.id)) {
                    subjectMap.set(subj.id, {
                        id: subj.id,
                        name: subj.name,
                        abbreviation: subj.abbreviation || null,
                        subjectGroupId: subj.subjectGroupId || null,
                        subjectGroupName: ((_a = subj.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || null,
                        subjectGroupShortAbbr: ((_b = subj.subjectGroup) === null || _b === void 0 ? void 0 : _b.shortAbbreviation) || null,
                        subjectGroupLongAbbr: ((_c = subj.subjectGroup) === null || _c === void 0 ? void 0 : _c.longAbbreviation) || null,
                        usesLiteralGrades: subj.usesLiteralGrades || false,
                    });
                }
            }
        }
        const allSubjects = Array.from(subjectMap.values());
        // Only include subjects that are in the grade's official curriculum
        // (PeriodGradeSubject). Subjects from student inscriptions that don't
        // belong to this grade (e.g. Biology from a different grade) are excluded
        // so they don't leak into the Excel columns.
        const pgSubjectIds = new Set(pgSubjects.map(pgs => pgs.subjectId).filter(Boolean));
        const groupedSubjectIds = new Set(allSubjects.filter(s => s.subjectGroupId !== null).map(s => s.id));
        // For MP sections, build academicSubjects from the full grade curriculum
        // (PeriodGradeSubject) in canonical order, so each subject maps to its
        // correct subj_i position. Only subjects that have PendingSubject students
        // (i.e., are in subjectMap) will actually be written to cells; the rest
        // keep their template placeholders (asterisks).
        // For regular sections, collapse group subjects into one column.
        let academicSubjects;
        if (isMpSection && !historicalMode) {
            const mpSubjectIds = new Set(allSubjects.map(s => s.id));
            academicSubjects = pgSubjects
                .map((pgs) => {
                var _a, _b, _c;
                const subj = pgs.subject;
                if (!subj)
                    return null;
                return {
                    id: subj.id,
                    name: subj.name,
                    abbreviation: subj.abbreviation || null,
                    subjectGroupId: subj.subjectGroupId || null,
                    subjectGroupName: ((_a = subj.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || null,
                    subjectGroupShortAbbr: ((_b = subj.subjectGroup) === null || _b === void 0 ? void 0 : _b.shortAbbreviation) || null,
                    subjectGroupLongAbbr: ((_c = subj.subjectGroup) === null || _c === void 0 ? void 0 : _c.longAbbreviation) || null,
                    usesLiteralGrades: subj.usesLiteralGrades || false,
                    hasMpStudents: mpSubjectIds.has(subj.id),
                };
            })
                .filter(Boolean);
        }
        else {
            // The Excel has one column per academic subject, but group subjects are
            // alternatives: a student has one subject from a group, not all of them.
            // Collapse all official subjects with the same subjectGroupId into one
            // representative column while preserving every student's actual subject
            // for the grade lookup below.
            const officialSubjects = allSubjects.filter(s => pgSubjectIds.has(s.id));
            const seenGroupIds = new Set();
            academicSubjects = officialSubjects.filter((subject) => {
                if (subject.subjectGroupId === null)
                    return true;
                if (seenGroupIds.has(subject.subjectGroupId))
                    return false;
                seenGroupIds.add(subject.subjectGroupId);
                return true;
            });
        }
        // Query teacher assignments for this section + periodGrade. Build map:
        // subjectId → { fullName, docWithType }
        const teacherAssignments = pg
            ? yield index_1.TeacherAssignment.findAll({
                where: { sectionId: section.id },
                include: [
                    {
                        model: index_1.PeriodGradeSubject,
                        as: 'periodGradeSubject',
                        required: true,
                        where: { periodGradeId: pg.id },
                    },
                    {
                        model: index_1.Person,
                        as: 'teacher',
                        attributes: ['firstName', 'lastName', 'documentType', 'document'],
                    },
                ],
            })
            : [];
        const teacherMap = new Map();
        for (const ta of teacherAssignments) {
            const pgs = ta.periodGradeSubject;
            const teacher = ta.teacher;
            if (pgs && teacher) {
                const docType = teacher.documentType === 'Venezolano' ? 'V' :
                    teacher.documentType === 'Extranjero' ? 'E' : 'V';
                teacherMap.set(pgs.subjectId, {
                    fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
                    docWithType: docType + ' ' + (teacher.document || ''),
                });
            }
        }
        // Apply manual group signers from Setting. For each subject group that has
        // a saved signer, override the teacherMap so that every subject in the group
        // maps to the chosen signer's data. This ensures the collapsed group column
        // shows the manually-selected teacher instead of the first-by-iteration one.
        const groupSubjectMap = new Map(); // subjectGroupId → [subjectId...]
        for (const pgs of pgSubjects) {
            const subj = pgs.subject;
            if (subj && subj.subjectGroupId) {
                const arr = groupSubjectMap.get(subj.subjectGroupId) || [];
                arr.push(subj.id);
                groupSubjectMap.set(subj.subjectGroupId, arr);
            }
        }
        if (groupSubjectMap.size > 0) {
            const signerKeys = Array.from(groupSubjectMap.keys()).map((gid) => `group_signer_${Number(schoolPeriodId)}_${Number(gradeId)}_${gid}`);
            const signerSettings = yield index_1.Setting.findAll({ where: { key: signerKeys } });
            for (const s of signerSettings) {
                const signerPersonId = Number(s.value);
                if (!signerPersonId)
                    continue;
                // Extract subjectGroupId from key: group_signer_{periodId}_{gradeId}_{subjectGroupId}
                const parts = s.key.split('_');
                const subjectGroupId = Number(parts[parts.length - 1]);
                const subjectIds = groupSubjectMap.get(subjectGroupId);
                if (!subjectIds)
                    continue;
                // Find the signer's data from the teacherAssignments we already have.
                // The signer might be assigned to any subject in the group (any section).
                // We look for a TeacherAssignment whose teacherId matches signerPersonId.
                let signerData = null;
                for (const ta of teacherAssignments) {
                    const teacher = ta.teacher;
                    if (teacher && teacher.id === signerPersonId) {
                        const docType = teacher.documentType === 'Venezolano' ? 'V' :
                            teacher.documentType === 'Extranjero' ? 'E' : 'V';
                        signerData = {
                            fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
                            docWithType: docType + ' ' + (teacher.document || ''),
                        };
                        break;
                    }
                }
                if (!signerData) {
                    // The signer is not in this section's TeacherAssignments. Fetch from Person.
                    const signerPerson = yield index_1.Person.findByPk(signerPersonId, {
                        attributes: ['firstName', 'lastName', 'documentType', 'document'],
                    });
                    if (signerPerson) {
                        const docType = signerPerson.documentType === 'Venezolano' ? 'V' :
                            signerPerson.documentType === 'Extranjero' ? 'E' : 'V';
                        signerData = {
                            fullName: `${signerPerson.lastName || ''} ${signerPerson.firstName || ''}`.trim(),
                            docWithType: docType + ' ' + (signerPerson.document || ''),
                        };
                    }
                }
                if (signerData) {
                    // Override all subjects in the group to use the signer
                    for (const subjId of subjectIds) {
                        teacherMap.set(subjId, signerData);
                    }
                }
            }
        }
        // For MP sections, calculate score from PendingSubject encounters.
        // The grade is the one from the LAST encounter with information —
        // approval clears subsequent encounters, so this is normally the
        // approving encounter; a later CE-edited encounter takes precedence.
        // For regular sections, use the standard term-grade calculation.
        const calculateMpScore = (pendingSubj) => {
            const encs = (pendingSubj.encounters || []).sort((a, b) => a.encounterNumber - b.encounterNumber);
            const lastScored = [...encs].reverse().find((e) => e.score !== null || e.isAbsent);
            if (lastScored)
                return lastScored.isAbsent ? 0 : Number(lastScored.score);
            return null;
        };
        const calculateFinalScore = historicalMode
            ? (insSub) => { var _a; return ((_a = insSub.finalGrade) === null || _a === void 0 ? void 0 : _a.finalScore) != null ? Number(insSub.finalGrade.finalScore) : null; }
            : isMpSection
                ? (insSub) => calculateMpScore(insSub)
                : (insSub) => {
                    // Build term grades with fallback to qualifications + councilPoints
                    const termGradesArr = gradeCalculationService_1.GradeCalculationService.buildTermGradesWithFallback((insSub.termGrades || []).map((tg) => ({ termId: tg.termId, score: Number(tg.score) })), insSub.qualifications || [], insSub.councilPoints || [], terms.map((t) => t.id));
                    // Build lapsos with council-done filter
                    const lapsos = terms.map((t) => {
                        const councilDone = isCouncilDone(t.id, Number(sectionId));
                        const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
                        return { termId: t.id, finalScore };
                    });
                    return gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos, insSub.finalGrade ? { finalScore: insSub.finalGrade.finalScore, gradeType: insSub.finalGrade.gradeType } : null);
                };
        // Resolve template path. Precedence:
        //   1. ?template= override in the query string
        //   2. Template assigned to the (grade, section) combination
        //   3. Template assigned to the grade (any section)
        // A template MUST be selected by the caller. There is no default fallback
        // so that a missing assignment surfaces as a clear error.
        const templatesRoot = path_1.default.resolve(process.cwd(), 'templates');
        let templatePath = null;
        if (template && typeof template === 'string') {
            const requested = path_1.default.basename(template);
            const candidate = path_1.default.join(templatesRoot, requested);
            if (!candidate.startsWith(templatesRoot) || !fs_1.default.existsSync(candidate)) {
                return res.status(400).json({ message: 'La plantilla seleccionada no existe' });
            }
            templatePath = candidate;
        }
        else {
            // Look up the template assigned to this grade (per-grade only;
            // all sections share the same template).
            const { Setting } = yield Promise.resolve().then(() => __importStar(require('../models/index.js')));
            const tryKey = (k) => Setting.findOne({ where: { key: k } });
            const gradeId = String(grade.id);
            const gradeKey = `template_assignment:grade:${gradeId}`;
            const assignment = yield tryKey(gradeKey);
            if (assignment && fs_1.default.existsSync(path_1.default.join(templatesRoot, path_1.default.basename(assignment.value)))) {
                templatePath = path_1.default.join(templatesRoot, path_1.default.basename(assignment.value));
            }
        }
        if (!templatePath) {
            return res.status(400).json({
                message: 'Debe seleccionar una plantilla (mediante ?template= en la URL o asignada al grado/sección).',
            });
        }
        const namedRanges = (0, templateNamedRanges_1.readTemplateNamedRanges)(templatePath);
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(templatePath);
        let sheet = workbook.getWorksheet(sheetName);
        if (!sheet) {
            sheet = workbook.worksheets[0];
        }
        const actualSheetName = sheet.name;
        // Helper: find a named range across any sheet. All named ranges in the
        // template are stored under '1er Año', but actualSheetName may differ
        // for higher grades (3er Año, 4to Año, etc.). This fallback ensures
        // lookups succeed regardless of the current sheet context.
        const findRef = (name) => {
            let r = namedRanges.getCell(actualSheetName, name);
            if (!r) {
                for (const sn of namedRanges.bySheet.keys()) {
                    r = namedRanges.getCell(sn, name);
                    if (r)
                        break;
                }
            }
            return r;
        };
        // Sort academic subjects by canonical order (subjectOrderMap) so subj_i
        // always maps to the same subject regardless of insertion order.
        const sortedAcademicSubjects = [...academicSubjects].sort((a, b) => {
            var _a, _b;
            const orderA = (_a = subjectOrderMap.get(a.id)) !== null && _a !== void 0 ? _a : 999;
            const orderB = (_b = subjectOrderMap.get(b.id)) !== null && _b !== void 0 ? _b : 999;
            return orderA - orderB;
        });
        const passingGrade = Number(settings.passing_grade) || 10;
        // Build statistics for exactly the students supplied. Grouped subjects
        // share one column and each student is counted once using the group subject
        // actually enrolled for that student.
        const buildSubjectStats = (students) => {
            const studentCountBySubject = new Map();
            const failedCountBySubject = new Map();
            const passedCountBySubject = new Map();
            const zeroCountBySubject = new Map();
            for (const columnSubject of sortedAcademicSubjects) {
                if (isMpSection && !columnSubject.hasMpStudents)
                    continue;
                let enrolled = 0;
                let failed = 0;
                let passed = 0;
                let zero = 0;
                for (const ins of students) {
                    const subjectsList = isMpSection
                        ? ins.pendingSubjects
                        : (ins.__groupAwareInscriptionSubjects || ins.inscriptionSubjects);
                    const insSub = subjectsList === null || subjectsList === void 0 ? void 0 : subjectsList.find((is) => {
                        var _a;
                        return is.subjectId === columnSubject.id || (columnSubject.subjectGroupId !== null &&
                            columnSubject.subjectGroupId !== undefined &&
                            ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === columnSubject.subjectGroupId);
                    });
                    if (!insSub)
                        continue;
                    enrolled++;
                    // Students with unresolved pending subjects show "P" in every
                    // subject — they count as "No aprobado" (never passed, never
                    // absent-counted) while their grades remain pending.
                    if (!isMpSection && pendingExcludedPersonIds && pendingExcludedPersonIds.has(ins.personId)) {
                        failed++;
                        continue;
                    }
                    const score = calculateFinalScore(insSub);
                    if (score == null)
                        continue;
                    if (score === 0)
                        zero++;
                    if ((0, gradeEvaluationService_1.isPassingGrade)(score, passingGrade))
                        passed++;
                    else
                        failed++;
                }
                studentCountBySubject.set(columnSubject.id, enrolled);
                failedCountBySubject.set(columnSubject.id, failed);
                passedCountBySubject.set(columnSubject.id, passed);
                zeroCountBySubject.set(columnSubject.id, zero);
            }
            return { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject };
        };
        const { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject } = buildSubjectStats(inscriptions);
        const totalStudents = inscriptions.length;
        // Discover subj_i named ranges and WRITE the abbreviation of the i-th
        // subject (in canonical order) into that cell. The map is subjIndex → subjectId
        // so that fillSheetByNamedRanges can look up which subject a column belongs to.
        const subjectColList = [];
        const subjectToSubjIndex = new Map();
        let subjIdx = 1;
        while (true) {
            const ref = findRef('subj_' + subjIdx);
            if (!ref)
                break;
            const subj = sortedAcademicSubjects[subjIdx - 1];
            if (subj && (!isMpSection || subj.hasMpStudents)) {
                const abbrText = subj.subjectGroupId
                    ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
                    : (subj.abbreviation || subj.name);
                const headerText = abbrText.toUpperCase();
                sheet.getCell(ref.cell).value = headerText;
                subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase(), subjIdx, subjectId: subj.id });
                subjectToSubjIndex.set(subjIdx, subj.id);
                // Also write the full subject name into subjname_i if defined
                const nameRef = findRef('subjname_' + subjIdx);
                const nameText = (subj.subjectGroupId
                    ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
                    : subj.name).toUpperCase();
                if (nameRef) {
                    sheet.getCell(nameRef.cell).value = nameText;
                }
                // The area table needs its own named ranges because Excel does not
                // allow the global subj_N name to point to two different cells.
                const areaRef = findRef('area_subj_' + subjIdx);
                const areaNameRef = findRef('area_subjname_' + subjIdx);
                const areaHeaderText = (subj.subjectGroupId
                    ? (subj.subjectGroupLongAbbr || '-')
                    : (subj.abbreviation || '-')).toUpperCase();
                if (areaRef) {
                    sheet.getCell(areaRef.cell).value = areaHeaderText;
                }
                if (areaNameRef) {
                    sheet.getCell(areaNameRef.cell).value = nameText;
                }
                // Write enrolled-student count per subject in the same column
                const countVal = studentCountBySubject.get(subj.id) || 0;
                const countRef = findRef('subj_count_' + subjIdx);
                if (countRef) {
                    sheet.getCell(countRef.cell).value = countVal;
                }
                // Write failed-student count per subject
                const failedVal = failedCountBySubject.get(subj.id) || 0;
                const failedRef = findRef('subj_failed_' + subjIdx);
                if (failedRef) {
                    sheet.getCell(failedRef.cell).value = failedVal;
                }
                // Write approved-student count per subject
                const passedVal = passedCountBySubject.get(subj.id) || 0;
                const passedRef = findRef('subj_passed_' + subjIdx);
                if (passedRef) {
                    sheet.getCell(passedRef.cell).value = passedVal;
                }
                // Write zero-score (inasistentes) count per subject
                const zeroVal = zeroCountBySubject.get(subj.id) || 0;
                const zeroRef = findRef('subj_zero_' + subjIdx);
                if (zeroRef) {
                    sheet.getCell(zeroRef.cell).value = zeroVal;
                }
                // Write unenrolled count per subject (total - enrolled)
                const unenrolledVal = totalStudents - (studentCountBySubject.get(subj.id) || 0);
                const unenrolledRef = findRef('subj_unenrolled_' + subjIdx);
                if (unenrolledRef) {
                    sheet.getCell(unenrolledRef.cell).value = unenrolledVal;
                }
            }
            subjIdx++;
        }
        // Note: the template defines subj_I named ranges for up to 9 subjects.
        // Only subjects with a corresponding subj_i named range are written.
        // Subjects beyond the template's named ranges are silently skipped to
        // preserve the Excel layout (no auto-appending columns).
        // Write teacher name and document for each subject in the "V. Profesores
        // por Áreas" section. Use the template's named ranges instead of a hardcoded
        // row limit, since some templates define teacher rows beyond row 65.
        const setTeacherData = (ws) => {
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const subj = sortedAcademicSubjects[i - 1];
                if (!subj)
                    continue;
                if (isMpSection && !subj.hasMpStudents)
                    continue;
                const teacher = teacherMap.get(subj.id);
                if (!teacher)
                    continue;
                const teacherNameRef = findRef(`teacher_name_${i}`);
                const teacherDocRef = findRef(`teacher_doc_${i}`);
                const teacherSignRef = findRef(`teacher_sign_${i}`);
                if (teacherNameRef)
                    ws.getCell(teacherNameRef.cell).value = teacher.fullName.toUpperCase();
                if (teacherDocRef)
                    ws.getCell(teacherDocRef.cell).value = teacher.docWithType.toUpperCase();
                // Remove the template placeholder only when a teacher exists. If no
                // teacher is assigned, leave the template cell untouched.
                if (teacherSignRef)
                    ws.getCell(teacherSignRef.cell).value = '';
            }
        };
        // Write teacher data on the original template sheet (will be inherited by
        // cloned sheets via cloneSheetInPlace).
        setTeacherData(sheet);
        // Group students by document type. Each group goes on its own set of
        // sheets, paginated every MAX_STUDENTS_PER_SHEET students.
        const docTypeGroups = [
            { label: 'Venezolano', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Venezolano'; }) },
            { label: 'Extranjero', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Extranjero'; }) },
            { label: 'Pasaporte', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Pasaporte'; }) },
            { label: 'Cedula Escolar', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Cedula Escolar'; }) },
        ];
        // Helper that clones a worksheet inside the same workbook (preserves
        // styles, borders, images, merges, decorative text like ***). Cloning
        // within the same workbook is what keeps the right border on column Z
        // intact on the copied sheet.
        const cloneSheetInPlace = (sourceWs, newName) => {
            const cloned = workbook.addWorksheet(newName);
            sourceWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const c = cloned.getRow(rowNum).getCell(colNumber);
                    c.value = cell.value && typeof cell.value === 'object' ? JSON.parse(JSON.stringify(cell.value)) : cell.value;
                    if (cell.style)
                        c.style = JSON.parse(JSON.stringify(cell.style));
                    if (cell.numFmt)
                        c.numFmt = cell.numFmt;
                });
                if (row.height != null)
                    cloned.getRow(rowNum).height = row.height;
            });
            if (sourceWs.columns) {
                sourceWs.columns.forEach((col, idx) => {
                    if (col && col.width != null)
                        cloned.getColumn(idx + 1).width = col.width;
                });
            }
            // Use mergeCellsWithoutStyle (not mergeCells) to avoid re-ordering
            // cellXfs in the workbook, which would convert the right border on
            // column Z (the table edge) into a left border on the cloned sheet.
            if (sourceWs.model.merges) {
                sourceWs.model.merges.forEach((merge) => cloned.mergeCellsWithoutStyle(merge));
            }
            return cloned;
        };
        // Helper that registers the template images in the workbook before any
        // cloning happens, so cellXfs stays stable during the clone.
        const originalImages = sheet.getImages();
        const originalMedia = ((_d = workbook.model) === null || _d === void 0 ? void 0 : _d.media) || [];
        const preImageIds = [];
        for (const img of originalImages) {
            const media = originalMedia[img.imageId];
            if (media && media.buffer) {
                preImageIds.push(workbook.addImage({
                    buffer: media.buffer,
                    extension: media.extension || 'png',
                }));
            }
            else {
                preImageIds.push(-1);
            }
        }
        // Helper that fills a single worksheet (already inside `workbook`) with
        // a given group of students at the given student offset. The worksheet is
        // expected to already be cloned from the template and named accordingly.
        const fillGroupPage = (ws, studentList, studentOffset, evalType, sectionTotal, pageCount) => {
            // Attach pre-registered images with the template's anchors
            const makeAnchor = (a) => ({
                nativeCol: a.nativeCol,
                nativeColOff: a.nativeColOff,
                nativeRow: a.nativeRow,
                nativeRowOff: a.nativeRowOff,
            });
            for (let i = 0; i < originalImages.length; i++) {
                const img = originalImages[i];
                if (preImageIds[i] < 0)
                    continue;
                ws.addImage(preImageIds[i], {
                    tl: makeAnchor(img.range.tl),
                    br: makeAnchor(img.range.br),
                    editAs: img.range.editAs,
                });
            }
            const pageStats = buildSubjectStats(studentList.slice(studentOffset, studentOffset + pageCount));
            const { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject, } = pageStats;
            // Write subject headers
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const ref = findRef('subj_' + i);
                const nameRef = findRef('subjname_' + i);
                const countRef = findRef('subj_count_' + i);
                const failedRef = findRef('subj_failed_' + i);
                const passedRef = findRef('subj_passed_' + i);
                const zeroRef = findRef('subj_zero_' + i);
                const unenrolledRef = findRef('subj_unenrolled_' + i);
                const subj = sortedAcademicSubjects[i - 1];
                if (subj && (!isMpSection || subj.hasMpStudents)) {
                    const abbrText = subj.subjectGroupId
                        ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
                        : (subj.abbreviation || subj.name);
                    const headerText = abbrText.toUpperCase();
                    if (ref)
                        ws.getCell(ref.cell).value = headerText;
                    const nameText = (subj.subjectGroupId
                        ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
                        : subj.name).toUpperCase();
                    if (nameRef) {
                        ws.getCell(nameRef.cell).value = nameText;
                    }
                    const areaRef = findRef('area_subj_' + i);
                    const areaNameRef = findRef('area_subjname_' + i);
                    const areaHeaderText = (subj.subjectGroupId
                        ? (subj.subjectGroupLongAbbr || '-')
                        : (subj.abbreviation || '-')).toUpperCase();
                    if (areaRef)
                        ws.getCell(areaRef.cell).value = areaHeaderText;
                    if (areaNameRef)
                        ws.getCell(areaNameRef.cell).value = nameText;
                    if (countRef) {
                        ws.getCell(countRef.cell).value = studentCountBySubject.get(subj.id) || 0;
                    }
                    if (failedRef) {
                        ws.getCell(failedRef.cell).value = failedCountBySubject.get(subj.id) || 0;
                    }
                    if (passedRef) {
                        ws.getCell(passedRef.cell).value = passedCountBySubject.get(subj.id) || 0;
                    }
                    if (zeroRef) {
                        ws.getCell(zeroRef.cell).value = zeroCountBySubject.get(subj.id) || 0;
                    }
                    if (unenrolledRef) {
                        ws.getCell(unenrolledRef.cell).value = pageCount - (studentCountBySubject.get(subj.id) || 0);
                    }
                }
            }
            // Fill the student rows
            fillSheetByNamedRanges(ws, ws.name, namedRanges, settings, plantel, period, studentList, academicSubjects, groupedSubjectIds, subjectColList, subjectToSubjIndex, calculateFinalScore, subjectOrderMap, studentOffset, actualSheetName, // named ranges registered under the original sheet
            templateGradeName, section === null || section === void 0 ? void 0 : section.name, letterGradesConfig, lastCouncilDate, isMpSection && !historicalMode, undefined, undefined, pendingExcludedPersonIds);
            // Override the evaluation type for this group. We do it after the
            // generic fill so it is not overwritten by the hard-coded default.
            const evalRef = findRef('inst_eval_type');
            if (evalRef)
                ws.getCell(evalRef.cell).value = String(evalType).toUpperCase();
            // Total students in the section and students on this page.
            // Named ranges for merged cells point to their top-left cell, so write
            // directly to that cell and preserve the template's merged layout.
            const setLocal = (name, value) => {
                if (value === undefined || value === null || value === '')
                    return;
                const r = findRef(name);
                if (r)
                    ws.getCell(r.cell).value = value;
            };
            setLocal('std_total', sectionTotal);
            setLocal('std_page_count', pageCount);
            // Replace formula references to named ranges with direct cell
            // references so that formulas resolve correctly in every cloned
            // sheet. Only use named ranges from the matching template sheet
            // (e.g. '1er Año' for '1er Año (1)') to avoid cross-sheet
            // collisions where the same name (e.g. subj_1) exists on every
            // template sheet pointing to different columns.
            const nameToRef = new Map();
            for (const [origName, namesMap] of namedRanges.bySheet) {
                if (ws.name.startsWith(origName)) {
                    for (const [name, ref] of namesMap) {
                        nameToRef.set(name, `'${ws.name}'!$${ref.cell}`);
                    }
                }
            }
            ws.eachRow((row) => {
                row.eachCell((cell) => {
                    const v = cell.value;
                    if (v && typeof v === 'object' && 'formula' in v) {
                        let formula = v.formula;
                        if (!formula)
                            return;
                        let changed = false;
                        for (const [name, cellRef] of nameToRef) {
                            const re = new RegExp(`\\b${name}\\b`, 'g');
                            const newFormula = formula.replace(re, cellRef);
                            if (newFormula !== formula) {
                                formula = newFormula;
                                changed = true;
                            }
                        }
                        if (changed) {
                            v.formula = formula;
                        }
                    }
                });
            });
        };
        // Keep an untouched worksheet as the clone source. The original sheet is
        // filled with the first document-type group, so it cannot be used as the
        // source for later groups without copying those students into them.
        const cleanTemplateSheet = cloneSheetInPlace(sheet, `${actualSheetName} (Template Source)`);
        // Render one or more pages for a given student group with the given
        // evaluation type. Returns the array of generated worksheet names.
        // The FIRST group rendered uses the original `sheet!` in-place (keeping
        // its original name `actualSheetName`) so that workbook-level defined
        // names (named ranges like subj_1, inst_code, etc.) which point to
        // `'1er Año'!$X$Y` remain valid. Formulas like `=subj_1` in the
        // template will resolve correctly. Subsequent groups and extra pages
        // are clones with different names.
        //
        // IMPORTANT: all clones are created BEFORE any fillGroupPage call so that
        // the template sheet isn't yet filled with student data. Otherwise each
        // clone would inherit the previous page's students in un-overwritten rows.
        const renderGroup = (group, evalType, groupLabel, isFirst) => {
            if (group.length === 0)
                return [];
            const pages = Math.ceil(group.length / MAX_STUDENTS_PER_SHEET);
            const pageSheets = [];
            const pageNames = [];
            // Phase 1: create all worksheets (clone from clean template).
            // Naming: 5to Año (Venezolano) (1), 5to Año (Venezolano) (2), ...
            for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
                const name = `${actualSheetName} (${groupLabel}) (${pageIdx + 1})`;
                if (isFirst && pageIdx === 0) {
                    pageSheets[0] = sheet;
                    pageNames[0] = name;
                }
                else {
                    pageSheets.push(cloneSheetInPlace(cleanTemplateSheet, name));
                    pageNames.push(name);
                }
            }
            // Rename original sheet in-place so it matches the naming convention.
            if (isFirst && pages > 0 && pageSheets[0] === sheet) {
                sheet.name = pageNames[0];
            }
            // Phase 2: fill each sheet with its slice of students
            for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
                const studentOffset = pageIdx * MAX_STUDENTS_PER_SHEET;
                const pageCount = Math.min(group.length - studentOffset, MAX_STUDENTS_PER_SHEET);
                fillGroupPage(pageSheets[pageIdx], group, studentOffset, evalType, inscriptions.length, pageCount);
            }
            return pageNames;
        };
        // Render each document-type group on its own set of sheets.
        let isFirst = true;
        const allSheetNames = [];
        for (const dtg of docTypeGroups) {
            if (dtg.students.length === 0)
                continue;
            const historicalEvalType = requestedHistoricalType === 'revision' ? 'Revisión' : null;
            const names = renderGroup(dtg.students, historicalEvalType || (isMpSection ? 'Materia Pendiente' : 'Final'), dtg.label, isFirst);
            allSheetNames.push(...names);
            isFirst = false;
        }
        if (allSheetNames.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes en esta sección' });
        }
        // Drop the un-filled template sheets (3er Año, 4to Año, 5to Año) and
        // the original `sheet!` if it was NOT used (no students at all). Keep
        // only the rendered group pages.
        const keepNames = new Set(allSheetNames);
        workbook.worksheets
            .filter(ws => !keepNames.has(ws.name))
            .forEach(ws => workbook.removeWorksheet(ws.id));
        // Re-register all named ranges as global entries with fully-qualified
        // sheet references (matching how the template itself stores them).
        // Excel handles duplicate global names gracefully by picking the one
        // matching the current sheet context. This avoids the issues with
        // localSheetId that caused Excel to reject the file.
        // Clear existing named ranges and re-add for remaining worksheets.
        workbook._definedNames.matrixMap = {};
        const addWithSheet = (name, wsName, cell) => {
            const sheetLabel = wsName.includes(' ') ? `'${wsName}'` : wsName;
            try {
                workbook.definedNames.add(`${sheetLabel}!$${cell}`, name);
            }
            catch (_a) { }
        };
        for (const ws of workbook.worksheets) {
            const wsName = ws.name;
            // Template named ranges
            for (const [origName, namesMap] of namedRanges.bySheet) {
                if (wsName.startsWith(origName)) {
                    for (const [name, ref] of namesMap) {
                        addWithSheet(name, wsName, ref.cell);
                    }
                }
            }
            // Re-register teacher named ranges only when they already exist in the template.
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const teacherNameRef = findRef(`teacher_name_${i}`);
                const teacherDocRef = findRef(`teacher_doc_${i}`);
                if (teacherNameRef) {
                    addWithSheet('teacher_name_' + i, wsName, teacherNameRef.cell);
                }
                if (teacherDocRef) {
                    addWithSheet('teacher_doc_' + i, wsName, teacherDocRef.cell);
                }
            }
        }
        const buffer = yield workbook.xlsx.writeBuffer();
        const fileName = 'resumen-rendimiento-' + grade.name.replace(/s+/g, '_') + '-' + section.name.replace(/s+/g, '_') + '.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportPerformanceSummary] Error:', error);
        res.status(500).json({ message: error.message || 'Error al exportar resumen de rendimiento' });
    }
});
exports.exportPerformanceSummary = exportPerformanceSummary;
// ── Resumen de Revisión ─────────────────────────────────────────────
// Same template and layout as exportPerformanceSummary, but:
//  - Only students with InscriptionSubjectRevision entries are included
//  - Only subjects that have revision entries appear as columns
//  - Each cell shows the revision result (approval score or last score)
const exportRevisionSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { schoolPeriodId, gradeId, sectionId, template } = req.query;
        const numericFields = [
            ['schoolPeriodId', schoolPeriodId],
            ['gradeId', gradeId],
            ['sectionId', sectionId],
        ];
        for (const [name, raw] of numericFields) {
            if (raw === undefined || raw === null || raw === '') {
                return res.status(400).json({ message: `${name} es requerido` });
            }
            const n = Number(raw);
            if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
                return res.status(400).json({ message: `${name} debe ser un número entero positivo` });
            }
        }
        const period = yield index_1.SchoolPeriod.findByPk(Number(schoolPeriodId));
        if (!period)
            return res.status(404).json({ message: 'Periodo no encontrado' });
        const grade = yield index_1.Grade.findByPk(Number(gradeId));
        if (!grade)
            return res.status(404).json({ message: 'Grado no encontrado' });
        const section = yield index_1.Section.findByPk(Number(sectionId));
        if (!section)
            return res.status(404).json({ message: 'Seccion no encontrada' });
        // Historical periods without academic structure use the same template/data
        // pipeline as the final summary, filtered to HistoricalGrade revision rows.
        const historicalPgCheck = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
            attributes: ['id'],
        });
        if (!historicalPgCheck) {
            req.query.historicalGradeType = 'revision';
            return (0, exports.exportPerformanceSummary)(req, res);
        }
        // Find the revision period for this school period
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId: Number(schoolPeriodId) },
        });
        if (!revisionPeriod) {
            return res.status(404).json({ message: 'No hay período de revisión para este año escolar' });
        }
        const gradeOrder = grade.order || 1;
        const gradeSuffix = gradeOrder === 1 || gradeOrder === 3 ? 'ER' : gradeOrder === 2 ? 'DO' : 'TO';
        const templateGradeName = `${gradeOrder}${gradeSuffix} AÑO`;
        const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';
        const pg = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
        });
        if (!pg)
            return res.status(404).json({ message: 'Estructura academica no encontrada' });
        // Find all InscriptionSubjectRevision entries for this revision period + section
        const revisionEntries = yield index_1.InscriptionSubjectRevision.findAll({
            where: {
                revisionPeriodId: revisionPeriod.id,
            },
            include: [
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubject',
                    required: true,
                    include: [
                        { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                        {
                            model: index_1.Inscription,
                            as: 'inscription',
                            where: {
                                schoolPeriodId: Number(schoolPeriodId),
                                sectionId: Number(sectionId),
                                gradeId: Number(gradeId),
                            },
                            include: [{ association: 'student', include: [{ model: index_1.PersonResidence, as: 'residence' }] }],
                        },
                    ],
                },
            ],
        });
        // Exclude subjects flagged as "No Reparable" — they are excluded from
        // revision, so their revision entries (if any predate the flag) must not
        // appear in this export.
        const notRepairableMap = yield (0, subjectOrderService_1.getSubjectNotRepairableMapByGradeAndPeriod)(Number(gradeId), Number(schoolPeriodId));
        const notRepairableSubjectIds = new Set();
        for (const [subjectId, notRepairable] of notRepairableMap.entries()) {
            if (notRepairable)
                notRepairableSubjectIds.add(subjectId);
        }
        const filteredRevisionEntries = revisionEntries.filter((rev) => {
            const insSub = rev.inscriptionSubject;
            return !(insSub === null || insSub === void 0 ? void 0 : insSub.subjectId) || !notRepairableSubjectIds.has(insSub.subjectId);
        });
        if (filteredRevisionEntries.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
        }
        // A revision row is created for every enrolled subject when the repair
        // period opens, with status 'pending' and a null score. Those rows do not
        // represent an actual repair grade, so only rows that were really graded
        // count towards the report.
        const isGradedRevision = (rev) => rev.score !== null && rev.score !== undefined;
        // Build a set of subjectIds that have at least one graded revision
        const revisionSubjectIds = new Set();
        for (const rev of filteredRevisionEntries) {
            if (!isGradedRevision(rev))
                continue;
            const insSub = rev.inscriptionSubject;
            if (insSub === null || insSub === void 0 ? void 0 : insSub.subject) {
                revisionSubjectIds.add(insSub.subject.id);
            }
        }
        if (revisionSubjectIds.size === 0) {
            return res.status(404).json({ message: 'No hay notas de revisión registradas en esta sección' });
        }
        // Build a set of personIds (students) that have at least one graded revision
        const revisionStudentIds = new Set();
        for (const rev of filteredRevisionEntries) {
            if (!isGradedRevision(rev))
                continue;
            const ins = (_a = rev.inscriptionSubject) === null || _a === void 0 ? void 0 : _a.inscription;
            if (ins === null || ins === void 0 ? void 0 : ins.personId) {
                revisionStudentIds.add(ins.personId);
            }
        }
        // Build a map: inscriptionSubjectId → revisions array
        const revisionsByInsSub = new Map();
        for (const rev of filteredRevisionEntries) {
            if (!revisionsByInsSub.has(rev.inscriptionSubjectId)) {
                revisionsByInsSub.set(rev.inscriptionSubjectId, []);
            }
            revisionsByInsSub.get(rev.inscriptionSubjectId).push(rev);
        }
        // Load inscriptions for ONLY the students that have revision entries
        const inscriptions = yield index_1.Inscription.findAll({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                sectionId: Number(sectionId),
                gradeId: Number(gradeId),
                personId: { [sequelize_1.Op.in]: Array.from(revisionStudentIds) },
            },
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    include: [{ model: index_1.PersonResidence, as: 'residence' }],
                },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                    ],
                },
            ],
            order: [
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        if (inscriptions.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
        }
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        const subjectOrderMap = yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id);
        // Query PeriodGradeSubject to get canonical order and subject info
        const pgSubjects = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id },
            include: [{ model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] }],
        });
        // Build academicSubjects from the FULL grade curriculum so that each
        // subject keeps its canonical position (subj_1, subj_2, …). Subjects
        // without repair grades are flagged and simply left untouched, preserving
        // the template's own placeholders ("**").
        const academicSubjects = pgSubjects
            .map((pgs) => {
            var _a, _b, _c;
            const subj = pgs.subject;
            if (!subj)
                return null;
            return {
                id: subj.id,
                name: subj.name,
                abbreviation: subj.abbreviation || null,
                subjectGroupId: subj.subjectGroupId || null,
                subjectGroupName: ((_a = subj.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || null,
                subjectGroupShortAbbr: ((_b = subj.subjectGroup) === null || _b === void 0 ? void 0 : _b.shortAbbreviation) || null,
                subjectGroupLongAbbr: ((_c = subj.subjectGroup) === null || _c === void 0 ? void 0 : _c.longAbbreviation) || null,
                usesLiteralGrades: subj.usesLiteralGrades || false,
                hasRevisionStudents: revisionSubjectIds.has(subj.id),
            };
        })
            .filter(Boolean);
        // Query teacher assignments for this section
        const teacherAssignments = yield index_1.TeacherAssignment.findAll({
            where: { sectionId: section.id },
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    required: true,
                    where: { periodGradeId: pg.id },
                },
                {
                    model: index_1.Person,
                    as: 'teacher',
                    attributes: ['firstName', 'lastName', 'documentType', 'document'],
                },
            ],
        });
        const teacherMap = new Map();
        for (const ta of teacherAssignments) {
            const pgs = ta.periodGradeSubject;
            const teacher = ta.teacher;
            if (pgs && teacher) {
                const docType = teacher.documentType === 'Venezolano' ? 'V' :
                    teacher.documentType === 'Extranjero' ? 'E' : 'V';
                teacherMap.set(pgs.subjectId, {
                    fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
                    docWithType: docType + ' ' + (teacher.document || ''),
                });
            }
        }
        // Apply manual group signers from Setting (same logic as exportPerformanceSummary)
        const groupSubjectMap = new Map();
        for (const pgs of pgSubjects) {
            const subj = pgs.subject;
            if (subj && subj.subjectGroupId) {
                const arr = groupSubjectMap.get(subj.subjectGroupId) || [];
                arr.push(subj.id);
                groupSubjectMap.set(subj.subjectGroupId, arr);
            }
        }
        if (groupSubjectMap.size > 0) {
            const signerKeys = Array.from(groupSubjectMap.keys()).map((gid) => `group_signer_${Number(schoolPeriodId)}_${Number(gradeId)}_${gid}`);
            const signerSettings = yield index_1.Setting.findAll({ where: { key: signerKeys } });
            for (const s of signerSettings) {
                const signerPersonId = Number(s.value);
                if (!signerPersonId)
                    continue;
                const parts = s.key.split('_');
                const subjectGroupId = Number(parts[parts.length - 1]);
                const subjectIds = groupSubjectMap.get(subjectGroupId);
                if (!subjectIds)
                    continue;
                let signerData = null;
                for (const ta of teacherAssignments) {
                    const teacher = ta.teacher;
                    if (teacher && teacher.id === signerPersonId) {
                        const docType = teacher.documentType === 'Venezolano' ? 'V' :
                            teacher.documentType === 'Extranjero' ? 'E' : 'V';
                        signerData = {
                            fullName: `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim(),
                            docWithType: docType + ' ' + (teacher.document || ''),
                        };
                        break;
                    }
                }
                if (!signerData) {
                    const signerPerson = yield index_1.Person.findByPk(signerPersonId, {
                        attributes: ['firstName', 'lastName', 'documentType', 'document'],
                    });
                    if (signerPerson) {
                        const docType = signerPerson.documentType === 'Venezolano' ? 'V' :
                            signerPerson.documentType === 'Extranjero' ? 'E' : 'V';
                        signerData = {
                            fullName: `${signerPerson.lastName || ''} ${signerPerson.firstName || ''}`.trim(),
                            docWithType: docType + ' ' + (signerPerson.document || ''),
                        };
                    }
                }
                if (signerData) {
                    for (const subjId of subjectIds) {
                        teacherMap.set(subjId, signerData);
                    }
                }
            }
        }
        // Calculate revision score: if approved in any opportunity → approval score,
        // otherwise the last recorded score, otherwise null.
        // Returns { score, isAbsent } so the Excel can show "I" for absent students.
        const calculateRevisionScore = (insSub) => {
            const revs = revisionsByInsSub.get(insSub.id) || [];
            if (revs.length === 0)
                return null;
            const sorted = revs.sort((a, b) => a.opportunity - b.opportunity);
            const approved = sorted.find((r) => r.status === 'approved' && r.score != null);
            if (approved)
                return Number(approved.score);
            const lastScored = [...sorted].reverse().find((r) => r.score != null);
            return lastScored ? Number(lastScored.score) : null;
        };
        // Check if the last scored revision for this insSub was an absence.
        const isRevisionAbsent = (insSub) => {
            const revs = revisionsByInsSub.get(insSub.id) || [];
            if (revs.length === 0)
                return false;
            const sorted = revs.sort((a, b) => a.opportunity - b.opportunity);
            const approved = sorted.find((r) => r.status === 'approved' && r.score != null);
            if (approved)
                return false;
            const lastScored = [...sorted].reverse().find((r) => r.score != null);
            return lastScored ? !!lastScored.isAbsent : false;
        };
        const settings = yield getInstitutionSettings();
        const letterGradesConfig = (() => {
            try {
                const raw = settings.letter_grades;
                if (!raw)
                    return [];
                const parsed = JSON.parse(raw);
                return parsed.scale || parsed || [];
            }
            catch (_a) {
                return [];
            }
        })();
        let plantel = null;
        if (settings.institution_dea_code) {
            plantel = yield index_1.Plantel.findOne({ where: { code: settings.institution_dea_code } });
        }
        // Only grouped subjects that actually have repair grades may write the
        // "Participación en Grupos" column; otherwise leave the template as is.
        const groupedSubjectIds = new Set(academicSubjects
            .filter((s) => s.subjectGroupId !== null && s.hasRevisionStudents)
            .map((s) => s.id));
        // Resolve template path (same logic as exportPerformanceSummary)
        const templatesRoot = path_1.default.resolve(process.cwd(), 'templates');
        let templatePath = null;
        if (template && typeof template === 'string') {
            const requested = path_1.default.basename(template);
            const candidate = path_1.default.join(templatesRoot, requested);
            if (!candidate.startsWith(templatesRoot) || !fs_1.default.existsSync(candidate)) {
                return res.status(400).json({ message: 'La plantilla seleccionada no existe' });
            }
            templatePath = candidate;
        }
        else {
            const tryKey = (k) => index_1.Setting.findOne({ where: { key: k } });
            const gradeIdStr = String(grade.id);
            const gradeKey = `template_assignment:grade:${gradeIdStr}`;
            const assignment = yield tryKey(gradeKey);
            if (assignment && fs_1.default.existsSync(path_1.default.join(templatesRoot, path_1.default.basename(assignment.value)))) {
                templatePath = path_1.default.join(templatesRoot, path_1.default.basename(assignment.value));
            }
        }
        if (!templatePath) {
            return res.status(400).json({
                message: 'Debe seleccionar una plantilla (mediante ?template= en la URL o asignada al grado/sección).',
            });
        }
        const namedRanges = (0, templateNamedRanges_1.readTemplateNamedRanges)(templatePath);
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(templatePath);
        let sheet = workbook.getWorksheet(sheetName);
        if (!sheet) {
            sheet = workbook.worksheets[0];
        }
        const actualSheetName = sheet.name;
        const findRef = (name) => {
            let r = namedRanges.getCell(actualSheetName, name);
            if (!r) {
                for (const sn of namedRanges.bySheet.keys()) {
                    r = namedRanges.getCell(sn, name);
                    if (r)
                        break;
                }
            }
            return r;
        };
        const sortedAcademicSubjects = [...academicSubjects].sort((a, b) => {
            var _a, _b;
            const orderA = (_a = subjectOrderMap.get(a.id)) !== null && _a !== void 0 ? _a : 999;
            const orderB = (_b = subjectOrderMap.get(b.id)) !== null && _b !== void 0 ? _b : 999;
            return orderA - orderB;
        });
        const passingGrade = Number(settings.passing_grade) || 10;
        // Build statistics
        const buildSubjectStats = (students) => {
            const studentCountBySubject = new Map();
            const failedCountBySubject = new Map();
            const passedCountBySubject = new Map();
            const zeroCountBySubject = new Map();
            for (const columnSubject of sortedAcademicSubjects) {
                if (!(columnSubject === null || columnSubject === void 0 ? void 0 : columnSubject.hasRevisionStudents))
                    continue;
                let enrolled = 0;
                let failed = 0;
                let passed = 0;
                let zero = 0;
                for (const ins of students) {
                    const insSub = (ins.inscriptionSubjects || []).find((is) => {
                        var _a;
                        return is.subjectId === columnSubject.id || (columnSubject.subjectGroupId !== null &&
                            columnSubject.subjectGroupId !== undefined &&
                            ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === columnSubject.subjectGroupId);
                    });
                    if (!insSub)
                        continue;
                    // Count only students that actually have a repair grade for this
                    // subject, not everyone enrolled in it.
                    const score = calculateRevisionScore(insSub);
                    if (score == null)
                        continue;
                    enrolled++;
                    if (score === 0)
                        zero++;
                    if ((0, gradeEvaluationService_1.isPassingGrade)(score, passingGrade))
                        passed++;
                    else
                        failed++;
                }
                studentCountBySubject.set(columnSubject.id, enrolled);
                failedCountBySubject.set(columnSubject.id, failed);
                passedCountBySubject.set(columnSubject.id, passed);
                zeroCountBySubject.set(columnSubject.id, zero);
            }
            return { studentCountBySubject, failedCountBySubject, passedCountBySubject, zeroCountBySubject };
        };
        // Total students in the section (ALL enrolled students, not only those
        // with repair grades). Used for the "no inscritos" per-subject count so
        // it reflects the real section size.
        const totalStudents = yield index_1.Inscription.count({
            where: {
                schoolPeriodId: Number(schoolPeriodId),
                sectionId: Number(sectionId),
                gradeId: Number(gradeId),
            },
        });
        // Build the subject-column map without writing anything to the template.
        // Headers and statistics are written later per page, based on the scores
        // present in that page only.
        const subjectColList = [];
        const subjectToSubjIndex = new Map();
        let subjIdx = 1;
        while (true) {
            const ref = findRef('subj_' + subjIdx);
            if (!ref)
                break;
            const subj = sortedAcademicSubjects[subjIdx - 1];
            if (subj && subj.hasRevisionStudents) {
                const abbrText = subj.subjectGroupId
                    ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
                    : (subj.abbreviation || subj.name);
                subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase(), subjIdx, subjectId: subj.id });
                subjectToSubjIndex.set(subjIdx, subj.id);
            }
            subjIdx++;
        }
        // Write teacher data only for subjects that have a score on the page.
        const setTeacherData = (ws, activeSubjectIds) => {
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const subj = sortedAcademicSubjects[i - 1];
                if (!subj || !activeSubjectIds.has(subj.id))
                    continue;
                const teacher = teacherMap.get(subj.id);
                if (!teacher)
                    continue;
                const teacherNameRef = findRef(`teacher_name_${i}`);
                const teacherDocRef = findRef(`teacher_doc_${i}`);
                const teacherSignRef = findRef(`teacher_sign_${i}`);
                if (teacherNameRef)
                    ws.getCell(teacherNameRef.cell).value = teacher.fullName.toUpperCase();
                if (teacherDocRef)
                    ws.getCell(teacherDocRef.cell).value = teacher.docWithType.toUpperCase();
                if (teacherSignRef)
                    ws.getCell(teacherSignRef.cell).value = '';
            }
        };
        // Group students by document type
        const docTypeGroups = [
            { label: 'Venezolano', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Venezolano'; }) },
            { label: 'Extranjero', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Extranjero'; }) },
            { label: 'Pasaporte', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Pasaporte'; }) },
            { label: 'Cedula Escolar', students: inscriptions.filter(ins => { var _a; return ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.documentType) === 'Cedula Escolar'; }) },
        ];
        const cloneSheetInPlace = (sourceWs, newName) => {
            const cloned = workbook.addWorksheet(newName);
            sourceWs.eachRow({ includeEmpty: true }, (row, rowNum) => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    const c = cloned.getRow(rowNum).getCell(colNumber);
                    c.value = cell.value && typeof cell.value === 'object' ? JSON.parse(JSON.stringify(cell.value)) : cell.value;
                    if (cell.style)
                        c.style = JSON.parse(JSON.stringify(cell.style));
                    if (cell.numFmt)
                        c.numFmt = cell.numFmt;
                });
                if (row.height != null)
                    cloned.getRow(rowNum).height = row.height;
            });
            if (sourceWs.columns) {
                sourceWs.columns.forEach((col, idx) => {
                    if (col && col.width != null)
                        cloned.getColumn(idx + 1).width = col.width;
                });
            }
            if (sourceWs.model.merges) {
                sourceWs.model.merges.forEach((merge) => cloned.mergeCellsWithoutStyle(merge));
            }
            return cloned;
        };
        const originalImages = sheet.getImages();
        const originalMedia = ((_b = workbook.model) === null || _b === void 0 ? void 0 : _b.media) || [];
        const preImageIds = [];
        for (const img of originalImages) {
            const media = originalMedia[img.imageId];
            if (media && media.buffer) {
                preImageIds.push(workbook.addImage({
                    buffer: media.buffer,
                    extension: media.extension || 'png',
                }));
            }
            else {
                preImageIds.push(-1);
            }
        }
        const fillGroupPage = (ws, studentList, studentOffset, evalType, sectionTotal, pageCount) => {
            const makeAnchor = (a) => ({
                nativeCol: a.nativeCol,
                nativeColOff: a.nativeColOff,
                nativeRow: a.nativeRow,
                nativeRowOff: a.nativeRowOff,
            });
            for (let i = 0; i < originalImages.length; i++) {
                const img = originalImages[i];
                if (preImageIds[i] < 0)
                    continue;
                ws.addImage(preImageIds[i], {
                    tl: makeAnchor(img.range.tl),
                    br: makeAnchor(img.range.br),
                    editAs: img.range.editAs,
                });
            }
            const pageStats = buildSubjectStats(studentList.slice(studentOffset, studentOffset + pageCount));
            const { studentCountBySubject: pgStCount, failedCountBySubject: pgFailCount, passedCountBySubject: pgPassCount, zeroCountBySubject: pgZeroCount, } = pageStats;
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const ref = findRef('subj_' + i);
                const nameRef = findRef('subjname_' + i);
                const countRef = findRef('subj_count_' + i);
                const failedRef = findRef('subj_failed_' + i);
                const passedRef = findRef('subj_passed_' + i);
                const zeroRef = findRef('subj_zero_' + i);
                const unenrolledRef = findRef('subj_unenrolled_' + i);
                const subj = sortedAcademicSubjects[i - 1];
                const hasPageRevision = Boolean(subj && subj.hasRevisionStudents && (pgStCount.get(subj.id) || 0) > 0);
                if (hasPageRevision) {
                    const abbrText = subj.subjectGroupId
                        ? (subj.subjectGroupShortAbbr || subj.subjectGroupLongAbbr || subj.name)
                        : (subj.abbreviation || subj.name);
                    const headerText = abbrText.toUpperCase();
                    if (ref)
                        ws.getCell(ref.cell).value = headerText;
                    const nameText = (subj.subjectGroupId
                        ? 'Participación en Grupos de \r\nCreación, Recreación y Producción'
                        : subj.name).toUpperCase();
                    if (nameRef)
                        ws.getCell(nameRef.cell).value = nameText;
                    const areaRef = findRef('area_subj_' + i);
                    const areaNameRef = findRef('area_subjname_' + i);
                    const areaHeaderText = (subj.subjectGroupId
                        ? (subj.subjectGroupLongAbbr || '-')
                        : (subj.abbreviation || '-')).toUpperCase();
                    if (areaRef)
                        ws.getCell(areaRef.cell).value = areaHeaderText;
                    if (areaNameRef)
                        ws.getCell(areaNameRef.cell).value = nameText;
                    if (countRef)
                        ws.getCell(countRef.cell).value = pgStCount.get(subj.id) || 0;
                    if (failedRef)
                        ws.getCell(failedRef.cell).value = pgFailCount.get(subj.id) || 0;
                    if (passedRef)
                        ws.getCell(passedRef.cell).value = pgPassCount.get(subj.id) || 0;
                    if (zeroRef)
                        ws.getCell(zeroRef.cell).value = pgZeroCount.get(subj.id) || 0;
                    if (unenrolledRef)
                        ws.getCell(unenrolledRef.cell).value = pageCount - (pgStCount.get(subj.id) || 0);
                }
            }
            const activeSubjectIds = new Set();
            for (const [subjectId, count] of pgStCount) {
                if (count > 0)
                    activeSubjectIds.add(subjectId);
            }
            setTeacherData(ws, activeSubjectIds);
            fillSheetByNamedRanges(ws, ws.name, namedRanges, settings, plantel, period, studentList, academicSubjects, groupedSubjectIds, subjectColList, subjectToSubjIndex, calculateRevisionScore, subjectOrderMap, studentOffset, actualSheetName, templateGradeName, section === null || section === void 0 ? void 0 : section.name, letterGradesConfig, null, // lastCouncilDate — not applicable for revision
            false, // isMpSection
            true, // isRevisionSection
            isRevisionAbsent);
            const evalRef = findRef('inst_eval_type');
            if (evalRef)
                ws.getCell(evalRef.cell).value = 'REVISIÓN';
            const setLocal = (name, value) => {
                if (value === undefined || value === null || value === '')
                    return;
                const r = findRef(name);
                if (r)
                    ws.getCell(r.cell).value = value;
            };
            setLocal('std_total', sectionTotal);
            setLocal('std_page_count', pageCount);
            const nameToRef = new Map();
            for (const [origName, namesMap] of namedRanges.bySheet) {
                if (ws.name.startsWith(origName)) {
                    for (const [name, ref] of namesMap) {
                        nameToRef.set(name, `'${ws.name}'!$${ref.cell}`);
                    }
                }
            }
            ws.eachRow((row) => {
                row.eachCell((cell) => {
                    const v = cell.value;
                    if (v && typeof v === 'object' && 'formula' in v) {
                        let formula = v.formula;
                        if (!formula)
                            return;
                        let changed = false;
                        for (const [name, cellRef] of nameToRef) {
                            const re = new RegExp(`\\b${name}\\b`, 'g');
                            const newFormula = formula.replace(re, cellRef);
                            if (newFormula !== formula) {
                                formula = newFormula;
                                changed = true;
                            }
                        }
                        if (changed) {
                            v.formula = formula;
                        }
                    }
                });
            });
        };
        const cleanTemplateSheet = cloneSheetInPlace(sheet, `${actualSheetName} (Template Source)`);
        const renderGroup = (group, evalType, groupLabel, isFirst) => {
            if (group.length === 0)
                return [];
            const pages = Math.ceil(group.length / MAX_STUDENTS_PER_SHEET);
            const pageSheets = [];
            const pageNames = [];
            for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
                const name = `${actualSheetName} (${groupLabel}) (${pageIdx + 1})`;
                if (isFirst && pageIdx === 0) {
                    pageSheets[0] = sheet;
                    pageNames[0] = name;
                }
                else {
                    pageSheets.push(cloneSheetInPlace(cleanTemplateSheet, name));
                    pageNames.push(name);
                }
            }
            if (isFirst && pages > 0 && pageSheets[0] === sheet) {
                sheet.name = pageNames[0];
            }
            for (let pageIdx = 0; pageIdx < pages; pageIdx++) {
                const studentOffset = pageIdx * MAX_STUDENTS_PER_SHEET;
                const pageCount = Math.min(group.length - studentOffset, MAX_STUDENTS_PER_SHEET);
                fillGroupPage(pageSheets[pageIdx], group, studentOffset, 'Revisión', totalStudents, pageCount);
            }
            return pageNames;
        };
        let isFirst = true;
        const allSheetNames = [];
        for (const dtg of docTypeGroups) {
            if (dtg.students.length === 0)
                continue;
            const names = renderGroup(dtg.students, 'Revisión', dtg.label, isFirst);
            allSheetNames.push(...names);
            isFirst = false;
        }
        if (allSheetNames.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes con revisión en esta sección' });
        }
        const keepNames = new Set(allSheetNames);
        workbook.worksheets
            .filter(ws => !keepNames.has(ws.name))
            .forEach(ws => workbook.removeWorksheet(ws.id));
        workbook._definedNames.matrixMap = {};
        const addWithSheet = (name, wsName, cell) => {
            const sheetLabel = wsName.includes(' ') ? `'${wsName}'` : wsName;
            try {
                workbook.definedNames.add(`${sheetLabel}!$${cell}`, name);
            }
            catch (_a) { }
        };
        for (const ws of workbook.worksheets) {
            const wsName = ws.name;
            for (const [origName, namesMap] of namedRanges.bySheet) {
                if (wsName.startsWith(origName)) {
                    for (const [name, ref] of namesMap) {
                        addWithSheet(name, wsName, ref.cell);
                    }
                }
            }
            for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
                const teacherNameRef = findRef(`teacher_name_${i}`);
                const teacherDocRef = findRef(`teacher_doc_${i}`);
                if (teacherNameRef) {
                    addWithSheet('teacher_name_' + i, wsName, teacherNameRef.cell);
                }
                if (teacherDocRef) {
                    addWithSheet('teacher_doc_' + i, wsName, teacherDocRef.cell);
                }
            }
        }
        const buffer = yield workbook.xlsx.writeBuffer();
        const fileName = 'resumen-revision-' + grade.name.replace(/\s+/g, '_') + '-' + section.name.replace(/\s+/g, '_') + '.xlsx';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportRevisionSummary] Error:', error);
        res.status(500).json({ message: error.message || 'Error al exportar resumen de revisión' });
    }
});
exports.exportRevisionSummary = exportRevisionSummary;
const getBoletinData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const schoolPeriodId = parseInt(req.query.schoolPeriodId, 10);
        const gradeId = parseInt(req.query.gradeId, 10);
        const sectionId = req.query.sectionId ? parseInt(req.query.sectionId, 10) : undefined;
        const inscriptionId = req.query.inscriptionId ? parseInt(req.query.inscriptionId, 10) : undefined;
        if (!schoolPeriodId || !gradeId) {
            return res.status(400).json({ message: 'schoolPeriodId y gradeId son obligatorios' });
        }
        const [period, grade, settingsRows] = yield Promise.all([
            index_1.SchoolPeriod.findByPk(schoolPeriodId),
            index_1.Grade.findByPk(gradeId),
            index_1.Setting.findAll(),
        ]);
        if (!period)
            return res.status(404).json({ message: 'Período no encontrado' });
        if (!grade)
            return res.status(404).json({ message: 'Grado no encontrado' });
        const boletinSection = sectionId ? yield index_1.Section.findByPk(sectionId) : null;
        const isMpSection = ((_a = boletinSection === null || boletinSection === void 0 ? void 0 : boletinSection.name) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === 'MATERIA PENDIENTE';
        const settings = {};
        settingsRows.forEach((s) => { settings[s.key] = s.value; });
        const periodGrade = yield index_1.PeriodGrade.findOne({
            where: { schoolPeriodId, gradeId },
        });
        const fallbackPeriodGrade = !periodGrade
            ? yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } }).then(current => current
                ? index_1.PeriodGrade.findOne({ where: { schoolPeriodId: current.id, gradeId } })
                : null)
            : null;
        const subjectOrderMap = periodGrade
            ? yield (0, subjectOrderService_1.getSubjectOrderMap)(periodGrade.id)
            : fallbackPeriodGrade
                ? yield (0, subjectOrderService_1.getSubjectOrderMap)(fallbackPeriodGrade.id)
                : new Map();
        // Fetch teacher assignments for this period+grade+section
        const periodGradeSubjects = periodGrade
            ? yield index_1.PeriodGradeSubject.findAll({ where: { periodGradeId: periodGrade.id } })
            : [];
        const pgsIds = periodGradeSubjects.map((pgs) => pgs.id);
        // Map: subjectId -> includeInAverage (default true)
        const includeInAverageMap = new Map();
        for (const pgs of periodGradeSubjects) {
            includeInAverageMap.set(pgs.subjectId, pgs.includeInAverage !== false);
        }
        const taWhere = { periodGradeSubjectId: pgsIds };
        if (sectionId)
            taWhere.sectionId = sectionId;
        const teacherAssignments = pgsIds.length > 0
            ? yield index_1.TeacherAssignment.findAll({
                where: taWhere,
                include: [{ model: index_1.Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }],
            })
            : [];
        // Map: subjectId -> teacher name
        const teacherMap = new Map();
        for (const ta of teacherAssignments) {
            const pgs = periodGradeSubjects.find((p) => p.id === ta.periodGradeSubjectId);
            if (pgs && ta.teacher) {
                const t = ta.teacher;
                teacherMap.set(pgs.subjectId, `${t.firstName || ''} ${t.lastName || ''}`.trim());
            }
        }
        // Fetch guide teachers for this period+grade
        const guideWhere = { schoolPeriodId, gradeId };
        if (sectionId)
            guideWhere.sectionId = sectionId;
        const sectionGuides = yield index_1.SectionGuide.findAll({
            where: guideWhere,
            include: [{ model: index_1.Person, as: 'guideTeacher', attributes: ['id', 'firstName', 'lastName'] }],
        });
        const guideMap = new Map();
        for (const sg of sectionGuides) {
            if (sg.guideTeacher) {
                const t = sg.guideTeacher;
                guideMap.set(sg.sectionId, `${t.firstName || ''} ${t.lastName || ''}`.trim());
            }
        }
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId },
            order: [['order', 'ASC']],
        });
        const termCount = terms.length || 1;
        // Determine which (termId, sectionId) pairs have their council completed (status: 'done')
        const councilChecklists = yield index_1.CouncilChecklist.findAll({
            where: Object.assign({ schoolPeriodId,
                gradeId, status: 'done', termId: terms.map((t) => t.id) }, (sectionId ? { sectionId } : {})),
            attributes: ['termId', 'sectionId', 'status', 'completedAt'],
        });
        const isCouncilDone = gradeCalculationService_1.GradeCalculationService.buildCouncilDoneChecker(councilChecklists.map((c) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })));
        // Find the completion date of the last term's council for this section.
        // Terms are sorted by order ASC, so the last done council for the section
        // gives us the date to show on the annual report.
        let lastCouncilCompletedAt = null;
        if (sectionId) {
            const doneForSection = councilChecklists
                .filter((c) => c.sectionId === sectionId && c.completedAt)
                .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
            if (doneForSection.length > 0) {
                lastCouncilCompletedAt = doneForSection[0].completedAt;
            }
        }
        const inscWhere = { schoolPeriodId, gradeId };
        if (sectionId)
            inscWhere.sectionId = sectionId;
        // Note: we don't filter by inscriptionId here so we can compute rank within section
        let inscriptions = yield index_1.Inscription.findAll({
            where: inscWhere,
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    include: [{ model: index_1.PersonResidence, as: 'residence' }],
                },
                { model: index_1.Section, as: 'section' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false },
                        { model: index_1.SubjectTermGrade, as: 'termGrades' },
                        {
                            model: index_1.Qualification,
                            as: 'qualifications',
                            include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan' }],
                        },
                        { model: index_1.CouncilPoint, as: 'councilPoints' },
                    ],
                },
            ],
            order: [
                [{ model: index_1.Section, as: 'section' }, 'name', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        if (inscriptions.length === 0 && !periodGrade) {
            const currentPeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
            const historicalPersonIds = yield index_1.HistoricalGrade.findAll({
                where: { schoolPeriodId, gradeId, gradeType: 'regular' },
                attributes: ['personId'],
            }).then(rows => [...new Set(rows.map(row => row.personId))]);
            if (currentPeriod && currentPeriod.id !== schoolPeriodId && historicalPersonIds.length > 0) {
                const currentInscriptions = yield index_1.Inscription.findAll({
                    where: { schoolPeriodId: currentPeriod.id, personId: historicalPersonIds },
                    include: [
                        { model: index_1.Person, as: 'student', include: [{ model: index_1.PersonResidence, as: 'residence' }] },
                        { model: index_1.Section, as: 'section' },
                    ],
                    order: [
                        [{ model: index_1.Section, as: 'section' }, 'name', 'ASC'],
                        [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                        [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
                    ],
                });
                const requestedSectionName = sectionId
                    ? (_c = (_b = (yield index_1.Section.findByPk(sectionId))) === null || _b === void 0 ? void 0 : _b.name) === null || _c === void 0 ? void 0 : _c.trim().toUpperCase()
                    : null;
                inscriptions = requestedSectionName
                    ? currentInscriptions.filter((ins) => { var _a, _b; return ((_b = (_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.trim().toUpperCase()) === requestedSectionName; })
                    : currentInscriptions;
            }
        }
        // Sort students canonically: document type → document number → lastName → firstName → grade → section
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        // Resolve the active term so group subjects are filtered per-term.
        const activeTerm = yield index_1.Term.findOne({ where: { schoolPeriodId, isActive: true } });
        const students = yield Promise.all(inscriptions.map((ins) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (!periodGrade) {
                let historicalGrades = yield index_1.HistoricalGrade.findAll({
                    where: {
                        personId: ins.personId,
                        gradeId,
                        schoolPeriodId,
                        gradeType: isMpSection ? { [sequelize_1.Op.in]: ['materia_pendiente', 'revision_materia_pendiente'] } : 'regular',
                    },
                    include: [{ model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] }],
                    order: [['subjectId', 'ASC']],
                });
                historicalGrades = (yield filterHistoricalGradesByCurrentPlantel(historicalGrades));
                const subjects = historicalGrades.map((historical) => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    return ({
                        id: historical.subjectId,
                        name: ((_b = (_a = historical.subject) === null || _a === void 0 ? void 0 : _a.subjectGroup) === null || _b === void 0 ? void 0 : _b.name) || ((_c = historical.subject) === null || _c === void 0 ? void 0 : _c.name) || historical.subjectName || '',
                        subjectName: ((_d = historical.subject) === null || _d === void 0 ? void 0 : _d.name) || historical.subjectName || '',
                        subjectAbbreviation: ((_e = historical.subject) === null || _e === void 0 ? void 0 : _e.abbreviation) || null,
                        subjectGroupId: ((_f = historical.subject) === null || _f === void 0 ? void 0 : _f.subjectGroupId) || null,
                        subjectGroupName: ((_h = (_g = historical.subject) === null || _g === void 0 ? void 0 : _g.subjectGroup) === null || _h === void 0 ? void 0 : _h.name) || null,
                        teacherName: '',
                        usesLiteralGrades: ((_j = historical.subject) === null || _j === void 0 ? void 0 : _j.usesLiteralGrades) || false,
                        includeInAverage: true,
                        lapsos: terms.map((term) => ({ termId: term.id, termName: term.name, score: null })),
                        finalScore: historical.finalScore != null ? Number(historical.finalScore) : null,
                        status: historical.status || 'reprobada',
                    });
                });
                return {
                    inscriptionId: ins.id,
                    firstName: ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.firstName) || '',
                    lastName: ((_b = ins.student) === null || _b === void 0 ? void 0 : _b.lastName) || '',
                    document: ((_c = ins.student) === null || _c === void 0 ? void 0 : _c.document) || '',
                    documentType: ((_d = ins.student) === null || _d === void 0 ? void 0 : _d.documentType) || '',
                    sectionName: ((_e = ins.section) === null || _e === void 0 ? void 0 : _e.name) || '',
                    sectionId: ins.sectionId,
                    guideTeacher: guideMap.get(ins.sectionId) || '',
                    subjects,
                };
            }
            const activeInscriptionSubjects = activeTerm
                ? yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(ins.inscriptionSubjects || [], activeTerm.id)
                : (0, subjectGroupService_1.filterActiveGroupSubjects)(ins.inscriptionSubjects || []);
            const insSubs = (0, subjectOrderService_1.sortSubjectsByOrder)(activeInscriptionSubjects, (is) => is.subjectId, (is) => { var _a; return ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.name) || ''; }, subjectOrderMap);
            const subjects = (yield Promise.all(insSubs.map((is) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                const studentSectionId = ins.sectionId || 0;
                const isGroupSubject = ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) != null;
                // Resolve qualifications, term grades and council points from the
                // subject selected for EACH term. Historical InscriptionSubject rows
                // remain intact but only the per-term choice is active.
                const lapsos = yield Promise.all(terms.map((t) => __awaiter(void 0, void 0, void 0, function* () {
                    var _a, _b;
                    const termSubjects = isGroupSubject
                        ? yield (0, subjectGroupService_1.filterActiveGroupSubjectsForTerm)(ins.inscriptionSubjects || [], t.id)
                        : [is];
                    const termSubject = isGroupSubject
                        ? termSubjects.find((candidate) => { var _a; return ((_a = candidate.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId) === is.subject.subjectGroupId; }) || is
                        : is;
                    const termGradesArr = gradeCalculationService_1.GradeCalculationService.buildTermGradesWithFallback((termSubject.termGrades || []).map((tg) => ({ termId: tg.termId, score: Number(tg.score) })), termSubject.qualifications || [], termSubject.councilPoints || [], terms.map((term) => term.id));
                    const councilDone = isCouncilDone(t.id, studentSectionId);
                    const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
                    return {
                        termId: t.id,
                        termName: t.name,
                        score: finalScore,
                        // Keep the selected group subject visible for this specific lapso.
                        subjectName: ((_a = termSubject.subject) === null || _a === void 0 ? void 0 : _a.name) || '',
                        subjectAbbreviation: ((_b = termSubject.subject) === null || _b === void 0 ? void 0 : _b.abbreviation) || null,
                    };
                })));
                // Group-subject annual grades must be calculated from the per-term
                // choices, not from one stored SubjectFinalGrade belonging to only one
                // of the historical group subjects.
                const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos.map((l) => ({ termId: l.termId, finalScore: l.score })), !isGroupSubject && is.finalGrade
                    ? { finalScore: is.finalGrade.finalScore, gradeType: is.finalGrade.gradeType }
                    : null);
                const subjectName = ((_b = is.subject) === null || _b === void 0 ? void 0 : _b.subjectGroupId)
                    ? (((_d = (_c = is.subject) === null || _c === void 0 ? void 0 : _c.subjectGroup) === null || _d === void 0 ? void 0 : _d.bulletinAbbreviation) || ((_f = (_e = is.subject) === null || _e === void 0 ? void 0 : _e.subjectGroup) === null || _f === void 0 ? void 0 : _f.name) || 'Participación en Grupos de Creación, Recreación y Producción')
                    : (((_g = is.subject) === null || _g === void 0 ? void 0 : _g.name) || '');
                return {
                    id: is.subjectId,
                    name: subjectName,
                    subjectName: ((_h = is.subject) === null || _h === void 0 ? void 0 : _h.name) || '',
                    subjectAbbreviation: ((_j = is.subject) === null || _j === void 0 ? void 0 : _j.abbreviation) || null,
                    subjectGroupId: ((_k = is.subject) === null || _k === void 0 ? void 0 : _k.subjectGroupId) || null,
                    subjectGroupName: ((_m = (_l = is.subject) === null || _l === void 0 ? void 0 : _l.subjectGroup) === null || _m === void 0 ? void 0 : _m.name) || null,
                    teacherName: teacherMap.get(is.subjectId) || '',
                    usesLiteralGrades: ((_o = is.subject) === null || _o === void 0 ? void 0 : _o.usesLiteralGrades) || false,
                    includeInAverage: includeInAverageMap.get(is.subjectId) !== false,
                    lapsos,
                    finalScore,
                    status: gradeCalculationService_1.GradeCalculationService.resolveStatus(finalScore, Number(settings.passing_grade || 10)),
                };
            }))));
            return {
                inscriptionId: ins.id,
                firstName: ((_f = ins.student) === null || _f === void 0 ? void 0 : _f.firstName) || '',
                lastName: ((_g = ins.student) === null || _g === void 0 ? void 0 : _g.lastName) || '',
                document: ((_h = ins.student) === null || _h === void 0 ? void 0 : _h.document) || '',
                documentType: ((_j = ins.student) === null || _j === void 0 ? void 0 : _j.documentType) || '',
                sectionName: ((_k = ins.section) === null || _k === void 0 ? void 0 : _k.name) || '',
                sectionId: ins.sectionId,
                guideTeacher: guideMap.get(ins.sectionId) || '',
                subjects,
            };
        })));
        // Load observations for all students in this boletin.
        // The boletin shows the observation from the last completed term for
        // each student's section (not from an arbitrary term).
        const inscriptionIds = students.map((s) => s.inscriptionId);
        // Determine the last completed term per section
        const sectionToLastDoneTerm = new Map();
        for (const s of students) {
            const sid = s.sectionId || 0;
            if (sectionToLastDoneTerm.has(sid))
                continue;
            let lastDoneTermId = null;
            for (const t of terms) {
                if (isCouncilDone(t.id, sid)) {
                    lastDoneTermId = t.id;
                }
            }
            if (lastDoneTermId != null) {
                sectionToLastDoneTerm.set(sid, lastDoneTermId);
            }
        }
        // Load observations only for the relevant (inscriptionId, termId) pairs
        const observationQueryPairs = [];
        for (const s of students) {
            const sid = s.sectionId || 0;
            const lastDoneTermId = sectionToLastDoneTerm.get(sid);
            if (lastDoneTermId != null) {
                observationQueryPairs.push({ inscriptionId: s.inscriptionId, termId: lastDoneTermId });
            }
        }
        const observationMap = new Map();
        if (observationQueryPairs.length > 0) {
            // Load all observations for these inscriptions and pick the right termId per student
            const allObs = yield index_1.StudentObservation.findAll({
                where: { inscriptionId: inscriptionIds, schoolPeriodId },
            });
            const obsByInscription = new Map();
            for (const obs of allObs) {
                if (!obsByInscription.has(obs.inscriptionId)) {
                    obsByInscription.set(obs.inscriptionId, new Map());
                }
                obsByInscription.get(obs.inscriptionId).set(obs.termId, obs.text);
            }
            for (const pair of observationQueryPairs) {
                const termMap = obsByInscription.get(pair.inscriptionId);
                if (termMap && termMap.has(pair.termId)) {
                    observationMap.set(pair.inscriptionId, termMap.get(pair.termId));
                }
            }
        }
        students.forEach((s) => {
            s.observation = observationMap.get(s.inscriptionId) || '';
        });
        // Compute rank within each section using the service
        const sectionGroups = new Map();
        for (const s of students) {
            const sid = s.sectionId || 0;
            if (!sectionGroups.has(sid))
                sectionGroups.set(sid, []);
            sectionGroups.get(sid).push(s);
        }
        const rankMap = new Map();
        for (const [, sectionStudents] of sectionGroups) {
            const withAvg = sectionStudents.map((s) => {
                const avg = gradeCalculationService_1.GradeCalculationService.calculateGeneralAverage(s.subjects, 'final');
                return { inscriptionId: s.inscriptionId, avg: avg !== null && avg !== void 0 ? avg : 0 };
            });
            const sorted = [...withAvg].sort((a, b) => b.avg - a.avg);
            let currentRank = 0;
            let prevAvg = null;
            sorted.forEach((entry, idx) => {
                if (prevAvg === null || entry.avg !== prevAvg) {
                    currentRank = idx + 1;
                    prevAvg = entry.avg;
                }
                rankMap.set(entry.inscriptionId, { position: currentRank, total: sorted.length });
            });
        }
        // Add rank info to each student
        const studentsWithRank = students.map((s) => {
            const rank = rankMap.get(s.inscriptionId);
            return Object.assign(Object.assign({}, s), { rankPosition: (rank === null || rank === void 0 ? void 0 : rank.position) || 0, rankTotal: (rank === null || rank === void 0 ? void 0 : rank.total) || 0 });
        });
        // Filter to only the requested student(s) if inscriptionId was specified
        const finalStudents = inscriptionId
            ? studentsWithRank.filter((s) => s.inscriptionId === inscriptionId)
            : studentsWithRank;
        res.json({
            institution: {
                name: settings.institution_name || '',
                period: period.name || period.period || '',
                code: settings.institution_code || '',
                principal: settings.principal_name || '',
                address: settings.institution_address || '',
                phone: settings.institution_phone || '',
                municipality: settings.institution_municipality || '',
                state: settings.institution_state || '',
            },
            passingGrade: Number(settings.passing_grade) || 10,
            grade: { id: grade.id, name: grade.name },
            terms: terms.map((t) => ({ id: t.id, name: t.name, order: t.order })),
            lastCouncilCompletedAt,
            students: finalStudents,
        });
    }
    catch (error) {
        console.error('[getBoletinData] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener datos de boletín' });
    }
});
exports.getBoletinData = getBoletinData;
// ── General Averages ──────────────────────────────────────────────
// Returns all students in a school period with their per-term grades
// so the frontend can compute averages and rankings dynamically.
const getGeneralAverages = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        }
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId },
            order: [['order', 'ASC']],
        });
        // Load PeriodGradeSubject to know which subjects count for average
        const periodGrades = yield index_1.PeriodGrade.findAll({
            where: { schoolPeriodId },
            attributes: ['id', 'gradeId', 'color'],
        });
        const periodGradeIds = periodGrades.map((pg) => pg.id);
        const pgsRecords = periodGradeIds.length > 0
            ? yield index_1.PeriodGradeSubject.findAll({ where: { periodGradeId: periodGradeIds } })
            : [];
        // Map: gradeId -> Set<subjectId> that count for average
        const gradeIdToPgId = new Map();
        const gradeColorMap = new Map();
        for (const pg of periodGrades) {
            gradeIdToPgId.set(pg.gradeId, pg.id);
            if (pg.color)
                gradeColorMap.set(pg.gradeId, pg.color);
        }
        const includeInAverageMap = new Map(); // gradeId -> subjectIds
        for (const pgs of pgsRecords) {
            if (pgs.includeInAverage === false)
                continue;
            const pgId = pgs.periodGradeId;
            const gradeId = (_a = periodGrades.find((pg) => pg.id === pgId)) === null || _a === void 0 ? void 0 : _a.gradeId;
            if (gradeId === undefined)
                continue;
            if (!includeInAverageMap.has(gradeId))
                includeInAverageMap.set(gradeId, new Set());
            includeInAverageMap.get(gradeId).add(pgs.subjectId);
        }
        // Query CouncilChecklist to know which (termId, sectionId) pairs have council done
        const councilChecklists = yield index_1.CouncilChecklist.findAll({
            where: {
                schoolPeriodId,
                status: 'done',
                termId: terms.map((t) => t.id),
            },
            attributes: ['termId', 'sectionId', 'status'],
        });
        const isCouncilDone = gradeCalculationService_1.GradeCalculationService.buildCouncilDoneChecker(councilChecklists.map((c) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })));
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId },
            include: [
                { model: index_1.Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'document', 'gender'] },
                { model: index_1.Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
                { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    attributes: ['id', 'subjectId'],
                    include: [
                        { model: index_1.SubjectTermGrade, as: 'termGrades', attributes: ['termId', 'score'] },
                        { model: index_1.Subject, as: 'subject', attributes: ['id', 'usesLiteralGrades'] },
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false, attributes: ['finalScore', 'gradeType'] },
                        {
                            model: index_1.Qualification,
                            as: 'qualifications',
                            attributes: ['score', 'remedialScore', 'isAbsent'],
                            include: [{ model: index_1.EvaluationPlan, as: 'evaluationPlan', attributes: ['percentage', 'termId'] }],
                        },
                        { model: index_1.CouncilPoint, as: 'councilPoints', attributes: ['termId', 'points'] },
                    ],
                },
            ],
            order: [
                [{ model: index_1.Grade, as: 'grade' }, 'name', 'ASC'],
                [{ model: index_1.Section, as: 'section' }, 'name', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        // Sort students canonically: document type → document number → lastName → firstName → grade → section
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        // Exclude "MATERIA PENDIENTE" sections — those are not regular grades
        const regularInscriptions = inscriptions.filter((ins) => { var _a; return (((_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) || '').toUpperCase() !== 'MATERIA PENDIENTE'; });
        const students = regularInscriptions.map((ins) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            const gradeId = ((_a = ins.grade) === null || _a === void 0 ? void 0 : _a.id) || 0;
            const studentSectionId = ((_b = ins.section) === null || _b === void 0 ? void 0 : _b.id) || 0;
            const averageEligibleSubjects = includeInAverageMap.get(gradeId);
            const termIds = terms.map((t) => t.id);
            // Build term score map: average of subjects that include in average
            // Only include scores from terms where council is done (final scores)
            const termScoreMap = new Map();
            // Also build per-subject finalScore for generalAverage (same method as boletin)
            const subjectFinalScores = [];
            // Per-subject data for the frontend to recompute averages with selected terms
            const subjectsData = [];
            (ins.inscriptionSubjects || []).forEach((is) => {
                var _a;
                const includeInAverage = averageEligibleSubjects ? averageEligibleSubjects.has(is.subjectId) : true;
                // Build term grades with fallback to qualifications + councilPoints
                const termGradesArr = gradeCalculationService_1.GradeCalculationService.buildTermGradesWithFallback((is.termGrades || []).map((tg) => ({ termId: tg.termId, score: Number(tg.score) })), is.qualifications || [], is.councilPoints || [], termIds);
                // Build lapsos for finalScore calculation (same as boletin)
                const lapsos = terms.map((t) => {
                    const councilDone = isCouncilDone(t.id, studentSectionId);
                    const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
                    return { termId: t.id, finalScore };
                });
                // Calculate subject finalScore using the service (same as boletin)
                const subjectFinalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos, is.finalGrade ? { finalScore: is.finalGrade.finalScore, gradeType: is.finalGrade.gradeType } : null);
                subjectFinalScores.push({
                    finalScore: subjectFinalScore,
                    includeInAverage,
                    gradeType: ((_a = is.finalGrade) === null || _a === void 0 ? void 0 : _a.gradeType) || null,
                });
                // Build per-subject term scores (null if council not done for that term)
                const subjectTermScores = terms.map((t) => {
                    const councilDone = isCouncilDone(t.id, studentSectionId);
                    if (!councilDone)
                        return { termId: t.id, score: null };
                    const tg = termGradesArr.find((tr) => tr.termId === t.id);
                    const raw = tg ? Number(tg.score) : 0;
                    if (raw <= 0)
                        return { termId: t.id, score: null };
                    return { termId: t.id, score: Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, (0, gradeEvaluationService_1.roundFinalGrade)(raw)) };
                });
                subjectsData.push({
                    includeInAverage,
                    termScores: subjectTermScores,
                    finalScore: subjectFinalScore,
                });
                // Skip subjects not configured for average (if we have the config)
                if (averageEligibleSubjects && !averageEligibleSubjects.has(is.subjectId))
                    return;
                termGradesArr.forEach((tg) => {
                    // Only include if council is done for this term+section
                    if (!isCouncilDone(tg.termId, studentSectionId))
                        return;
                    if (tg.score <= 0)
                        return; // skip zero scores (no data)
                    const score = Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, tg.score);
                    if (!termScoreMap.has(tg.termId))
                        termScoreMap.set(tg.termId, []);
                    termScoreMap.get(tg.termId).push(score);
                });
            });
            const termGrades = terms.map((t) => {
                const councilDone = isCouncilDone(t.id, studentSectionId);
                if (!councilDone) {
                    return { termId: t.id, termName: t.name, score: null };
                }
                const scores = termScoreMap.get(t.id) || [];
                const avg = scores.length > 0
                    ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
                    : null;
                return { termId: t.id, termName: t.name, score: avg };
            });
            // Calculate generalAverage using the same method as boletin (via service)
            const generalAverage = gradeCalculationService_1.GradeCalculationService.calculateGeneralAverage(subjectFinalScores, 'final');
            return {
                inscriptionId: ins.id,
                firstName: ((_c = ins.student) === null || _c === void 0 ? void 0 : _c.firstName) || '',
                lastName: ((_d = ins.student) === null || _d === void 0 ? void 0 : _d.lastName) || '',
                document: ((_e = ins.student) === null || _e === void 0 ? void 0 : _e.document) || '',
                gender: ((_f = ins.student) === null || _f === void 0 ? void 0 : _f.gender) || null,
                gradeId: ((_g = ins.grade) === null || _g === void 0 ? void 0 : _g.id) || 0,
                gradeName: ((_h = ins.grade) === null || _h === void 0 ? void 0 : _h.name) || '',
                _gradeOrder: (_k = (_j = ins.grade) === null || _j === void 0 ? void 0 : _j.order) !== null && _k !== void 0 ? _k : 9999,
                gradeColor: gradeColorMap.get(((_l = ins.grade) === null || _l === void 0 ? void 0 : _l.id) || 0) || null,
                sectionId: ((_m = ins.section) === null || _m === void 0 ? void 0 : _m.id) || 0,
                sectionName: ((_o = ins.section) === null || _o === void 0 ? void 0 : _o.name) || '',
                termGrades,
                generalAverage,
                subjects: subjectsData,
            };
        });
        res.json({
            terms: terms.map((t) => ({ id: t.id, name: t.name, order: t.order })),
            grades: [...new Set(students.map((s) => s.gradeId))].map((gid) => {
                var _a;
                const s = students.find((st) => st.gradeId === gid);
                return { id: gid, name: (s === null || s === void 0 ? void 0 : s.gradeName) || '', order: (_a = s === null || s === void 0 ? void 0 : s._gradeOrder) !== null && _a !== void 0 ? _a : 9999 };
            }).sort((a, b) => a.order - b.order),
            sections: [...new Set(students.map((s) => s.sectionId))].map((sid) => {
                const s = students.find((st) => st.sectionId === sid);
                return { id: sid, name: (s === null || s === void 0 ? void 0 : s.sectionName) || '', gradeId: (s === null || s === void 0 ? void 0 : s.gradeId) || 0 };
            }).sort((a, b) => a.name.localeCompare(b.name)),
            students,
        });
    }
    catch (error) {
        console.error('[getGeneralAverages] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener promedios generales' });
    }
});
exports.getGeneralAverages = getGeneralAverages;
/**
 * GET /api/performance-summary/titulo-data
 * Returns students who graduated (approved 5th year) for a given school period,
 * with all data needed to print titles (diplomas).
 *
 * Query params:
 * - schoolPeriodId: number (required)
 */
const getTituloData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const schoolPeriodId = parseInt(req.query.schoolPeriodId, 10);
        if (!schoolPeriodId) {
            return res.status(400).json({ message: 'schoolPeriodId es obligatorio' });
        }
        const [period, settingsRows] = yield Promise.all([
            index_1.SchoolPeriod.findByPk(schoolPeriodId),
            index_1.Setting.findAll(),
        ]);
        if (!period)
            return res.status(404).json({ message: 'Período no encontrado' });
        const settings = {};
        settingsRows.forEach((s) => { settings[s.key] = s.value; });
        // Find 5th grade (order = 5) — the graduating grade
        const fifthGrade = yield index_1.Grade.findOne({ where: { order: 5 } });
        if (!fifthGrade) {
            return res.status(404).json({ message: 'No se encontró el 5to año (grado con order=5)' });
        }
        // Find inscriptions for 5th grade in this period
        // Include periodOutcome optionally (may not exist if closure hasn't run)
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId, gradeId: fifthGrade.id },
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    include: [{ model: index_1.PersonResidence, as: 'residence' }],
                },
                { model: index_1.Section, as: 'section' },
                {
                    model: index_1.StudentPeriodOutcome,
                    as: 'periodOutcome',
                    required: false,
                },
            ],
            order: [
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        const students = inscriptions.map((ins) => {
            var _a;
            const person = ins.student;
            const residence = person === null || person === void 0 ? void 0 : person.residence;
            const outcome = ins.periodOutcome;
            // Format birthplace: "PAÍS, ESTADO, MUNICIPIO XXX" (Venezuela is assumed)
            const birthState = (residence === null || residence === void 0 ? void 0 : residence.birthState) || '';
            const birthMunicipality = (residence === null || residence === void 0 ? void 0 : residence.birthMunicipality) || '';
            const birthplace = ['VENEZUELA', birthState, birthMunicipality ? `MUNICIPIO ${birthMunicipality}` : '']
                .filter(Boolean)
                .join(', ');
            // Format birthdate: "04 DE ABRIL DE 2005"
            const birthdate = (person === null || person === void 0 ? void 0 : person.birthdate) ? formatDateLong(person.birthdate) : '';
            // Format document: "V 30.781.275"
            const docPrefix = (person === null || person === void 0 ? void 0 : person.documentType) === 'Venezolano' ? 'V'
                : (person === null || person === void 0 ? void 0 : person.documentType) === 'Extranjero' ? 'E'
                    : (person === null || person === void 0 ? void 0 : person.documentType) === 'Pasaporte' ? 'P' : 'CE';
            const docFormatted = (person === null || person === void 0 ? void 0 : person.document) ? `${docPrefix} ${person.document}` : '';
            // Full name in uppercase
            const fullName = `${(person === null || person === void 0 ? void 0 : person.lastName) || ''} ${(person === null || person === void 0 ? void 0 : person.firstName) || ''}`.trim().toUpperCase();
            return {
                inscriptionId: ins.id,
                personId: person === null || person === void 0 ? void 0 : person.id,
                fullName,
                document: docFormatted,
                birthplace,
                birthdate,
                finalAverage: (outcome === null || outcome === void 0 ? void 0 : outcome.finalAverage) != null ? Number(outcome.finalAverage).toFixed(2) : '',
                graduatedAt: outcome === null || outcome === void 0 ? void 0 : outcome.graduatedAt,
                outcomeStatus: (outcome === null || outcome === void 0 ? void 0 : outcome.status) || null,
                sectionName: ((_a = ins.section) === null || _a === void 0 ? void 0 : _a.name) || '',
            };
        });
        // Institution data
        const institution = {
            name: settings.institution_name || '',
            // Plantel code = Código DEA (institution_code is the modalidad code,
            // already included in the program field).
            code: settings.institution_dea_code || '',
            level: 'BACHILLER',
            program: settings.institution_program || 'EDUCACIÓN MEDIA GENERAL, 31059',
            directorName: settings.director_first_names && settings.director_last_names
                ? `${settings.director_first_names} ${settings.director_last_names}`
                : (settings.director_name || ''),
            directorDocument: settings.director_document || '',
            // sig2 (Control de Estudios) — from coordinator settings if available,
            // fall back to legacy titulo_sig2_* settings
            sig2Name: settings.control_estudios_first_names && settings.control_estudios_last_names
                ? `${settings.control_estudios_first_names} ${settings.control_estudios_last_names}`
                : (settings.control_estudios_name || settings.titulo_sig2_name || ''),
            sig2Id: settings.control_estudios_document || settings.titulo_sig2_id || '',
            // Issue place: "ESTADO, PARROQUIA, FECHA"
            issueState: settings.institution_state || '',
            issueParish: settings.institution_parish || '',
        };
        return res.json({ students, institution, schoolPeriodName: period.name });
    }
    catch (error) {
        console.error('[getTituloData] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener datos de títulos' });
    }
});
exports.getTituloData = getTituloData;
// Format a date as "DD DE MES DE YYYY" in Spanish
function formatDateLong(date) {
    const dateOnly = (0, councilDateResolver_1.formatDateOnly)(date);
    if (!dateOnly)
        return '';
    const [yyyy, month, day] = dateOnly.split('-').map(Number);
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    return `${String(day).padStart(2, '0')} DE ${months[month - 1]} DE ${yyyy}`;
}
/* ------------------------------------------------------------------ */
/* Group signer — manual selection of which teacher signs for a       */
/* subject group in the performance summary Excel.                    */
/* ------------------------------------------------------------------ */
/**
 * GET /api/performance-summary/group-teachers?schoolPeriodId=X&gradeId=Y
 *
 * Returns the subject groups that have more than one subject (i.e. groups
 * where a manual signer choice is needed) along with the teachers assigned
 * to each subject across all sections of the grade.
 *
 * Response:
 * [
 *   {
 *     subjectGroupId: 5,
 *     subjectGroupName: "Grupos de Creación",
 *     subjects: [
 *       { subjectId: 12, subjectName: "Música", teacherPersonId: 3, teacherName: "Pérez Juan" },
 *       { subjectId: 13, subjectName: "Teatro", teacherPersonId: 7, teacherName: "Gómez Ana" }
 *     ],
 *     currentSignerPersonId: 3   // from Setting, null if not set
 *   }
 * ]
 */
const getGroupTeachers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const schoolPeriodId = Number(req.query.schoolPeriodId);
        const gradeId = Number(req.query.gradeId);
        if (!schoolPeriodId || !gradeId) {
            return res.status(400).json({ message: 'schoolPeriodId y gradeId son requeridos' });
        }
        const pg = yield index_1.PeriodGrade.findOne({ where: { schoolPeriodId, gradeId } });
        if (!pg)
            return res.status(404).json({ message: 'Estructura académica no encontrada' });
        // Get all PeriodGradeSubject for this grade, with subject + subjectGroup
        const pgSubjects = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id },
            include: [{ model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] }],
        });
        // Get all TeacherAssignments for any section of this grade's PeriodGradeSubjects.
        // We want every teacher that teaches any subject of the group, regardless of section.
        const pgsIds = pgSubjects.map((p) => p.id);
        const teacherAssignments = pgsIds.length > 0
            ? yield index_1.TeacherAssignment.findAll({
                where: { periodGradeSubjectId: pgsIds },
                include: [
                    { model: index_1.PeriodGradeSubject, as: 'periodGradeSubject' },
                    { model: index_1.Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] },
                ],
            })
            : [];
        // Build subjectId → list of { personId, fullName } (dedup by personId)
        const subjectTeachersMap = new Map();
        for (const ta of teacherAssignments) {
            const pgs = ta.periodGradeSubject;
            const teacher = ta.teacher;
            if (!pgs || !teacher)
                continue;
            const list = subjectTeachersMap.get(pgs.subjectId) || [];
            const fullName = `${teacher.lastName || ''} ${teacher.firstName || ''}`.trim();
            if (!list.some((t) => t.personId === teacher.id)) {
                list.push({ personId: teacher.id, fullName });
            }
            subjectTeachersMap.set(pgs.subjectId, list);
        }
        const groupMap = new Map();
        for (const pgs of pgSubjects) {
            const subj = pgs.subject;
            if (!subj || subj.subjectGroupId === null)
                continue;
            const groupId = subj.subjectGroupId;
            const groupName = ((_a = subj.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || `Grupo ${groupId}`;
            const teachers = subjectTeachersMap.get(subj.id) || [];
            const entry = groupMap.get(groupId) || { subjectGroupId: groupId, subjectGroupName: groupName, subjects: [] };
            entry.subjects.push({
                subjectId: subj.id,
                subjectName: subj.name,
                teachers,
            });
            groupMap.set(groupId, entry);
        }
        // Only return groups that have at least 2 subjects (otherwise no choice to make)
        const groups = Array.from(groupMap.values()).filter((g) => g.subjects.length >= 2);
        // Load current signers from Setting
        const settingKeys = groups.map((g) => `group_signer_${schoolPeriodId}_${gradeId}_${g.subjectGroupId}`);
        const settings = settingKeys.length > 0
            ? yield index_1.Setting.findAll({ where: { key: settingKeys } })
            : [];
        const signerMap = new Map();
        for (const s of settings) {
            signerMap.set(s.key, Number(s.value));
        }
        const result = groups.map((g) => (Object.assign(Object.assign({}, g), { currentSignerPersonId: signerMap.get(`group_signer_${schoolPeriodId}_${gradeId}_${g.subjectGroupId}`) || null })));
        return res.json(result);
    }
    catch (error) {
        console.error('[getGroupTeachers] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener profesores de grupos' });
    }
});
exports.getGroupTeachers = getGroupTeachers;
/**
 * POST /api/performance-summary/group-signer
 * Body: { schoolPeriodId, gradeId, subjectGroupId, personId }
 *
 * Persists the chosen signer for a subject group in the Setting table.
 * If personId is null, removes the setting (revert to default behavior).
 */
const setGroupSigner = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, gradeId, subjectGroupId, personId } = req.body;
        if (!schoolPeriodId || !gradeId || !subjectGroupId) {
            return res.status(400).json({ message: 'schoolPeriodId, gradeId y subjectGroupId son requeridos' });
        }
        const key = `group_signer_${schoolPeriodId}_${gradeId}_${subjectGroupId}`;
        if (personId === null || personId === undefined) {
            yield index_1.Setting.destroy({ where: { key } });
            return res.json({ message: 'Signer eliminado' });
        }
        // upsert
        const [setting, created] = yield index_1.Setting.findOrCreate({
            where: { key },
            defaults: { key, value: String(personId) },
        });
        if (!created) {
            yield setting.update({ value: String(personId) });
        }
        return res.json({ message: 'Signer guardado', key, value: String(personId) });
    }
    catch (error) {
        console.error('[setGroupSigner] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al guardar signer' });
    }
});
exports.setGroupSigner = setGroupSigner;
