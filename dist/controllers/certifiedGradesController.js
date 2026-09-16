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
exports.exportReverso = exports.getCertifiedGradesData = exports.exportCertifiedGradesBySection = exports.exportCertifiedGrades = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const exceljs_1 = __importDefault(require("exceljs"));
const index_1 = require("../models/index.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const subjectGroupService_1 = require("../services/subjectGroupService.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const gradeCalculationService_1 = require("../services/gradeCalculationService.js");
const templateNamedRanges_1 = require("../services/templateNamedRanges.js");
const gradeDateResolver_1 = require("../services/gradeDateResolver.js");
const councilDateResolver_1 = require("../services/councilDateResolver.js");
const councilDateResolver_2 = require("../services/councilDateResolver.js");
const studentSortService_1 = require("../services/studentSortService.js");
function getStateAbbrev(stateName) {
    if (!stateName)
        return '';
    const abbrev = {
        'GUARICO': 'GU', 'MIRANDA': 'MI', 'CARABOBO': 'CA', 'ZULIA': 'ZU',
        'ARAGUA': 'AR', 'BARINAS': 'BA', 'BOLIVAR': 'BO', 'COJEDES': 'CO',
        'PORTUGUESA': 'PO', 'LARA': 'LA', 'YARACUY': 'YA', 'FALCON': 'FA',
        'VARGAS': 'VA', 'MERIDA': 'ME', 'TRUJILLO': 'TR', 'TACHIRA': 'TA',
        'APURE': 'AP', 'GUAIRA': 'GU', 'NUEVA ESPARTA': 'NE', 'SUCRE': 'SU',
        'ANZOATEGUI': 'AN', 'MONAGAS': 'MO', 'DELTA AMACURO': 'DA',
        'AMAZONAS': 'AM', 'DISTRITO CAPITAL': 'DC', 'DEPENDENCIAS FEDERALES': 'DF',
    };
    return abbrev[stateName.toUpperCase()] || stateName.substring(0, 2).toUpperCase();
}
function formatDateES(date) {
    if (!date)
        return '';
    // Parse "YYYY-MM-DD" strings without timezone shifts
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
        const parts = date.split('T')[0].split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${d} de ${months[m - 1]} de ${y}`;
    }
    const caracasDate = (0, councilDateResolver_1.formatDateInCaracas)(date);
    if (!caracasDate)
        return '';
    const parts = caracasDate.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${d} de ${months[m - 1]} de ${y}`;
}
function formatBirthdateES(date) {
    const dateOnly = (0, councilDateResolver_1.formatDateOnly)(date);
    if (!dateOnly)
        return '';
    const [year, month, day] = dateOnly.split('-').map(Number);
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${day} de ${months[month - 1]} de ${year}`;
}
function formatScore(score) {
    if (score === null || score === undefined)
        return '';
    const n = Number(score);
    if (isNaN(n) || n === 0)
        return '';
    return n.toFixed(1);
}
function padNumber(n) {
    return String(n).padStart(2, '0');
}
const monthsES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function monthNameES(monthNum) {
    if (monthNum < 1 || monthNum > 12)
        return '';
    return monthsES[monthNum - 1];
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
/**
 * Convert a subject name to Spanish title case: capitalize the first letter of
 * each word except articles, prepositions and conjunctions (y, de, del, la, el,
 * las, los, en, a, al, o, u, para, con, por). The first word is always capitalized.
 */
function toTitleCaseES(text) {
    if (!text)
        return '';
    const lowercaseWords = new Set(['y', 'de', 'del', 'la', 'el', 'las', 'los', 'en', 'a', 'al', 'o', 'u', 'para', 'con', 'por']);
    return text
        .trim()
        .split(/\s+/)
        .map((word, i) => {
        // Keep punctuation prefixes (like commas) intact
        const match = word.match(/^([^a-zA-ZÁÉÍÓÚáéíóú]*)([a-zA-ZÁÉÍÓÚáéíóú]+)(.*)$/);
        if (!match)
            return word;
        const prefix = match[1];
        const core = match[2];
        const suffix = match[3];
        const lower = core.toLowerCase();
        if (i > 0 && lowercaseWords.has(lower)) {
            return prefix + lower + suffix;
        }
        return prefix + lower.charAt(0).toUpperCase() + lower.slice(1) + suffix;
    })
        .join(' ');
}
function numberToSpanishWords(n) {
    const integerPart = Math.floor(n);
    const decimalPart = Math.round((n - integerPart) * 10);
    const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
        'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte'];
    const tens = ['', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    function convertInt(num) {
        if (num <= 20)
            return units[num];
        if (num < 30) {
            const remainder = num - 20;
            return remainder === 0 ? 'veinte' : `veinti${units[remainder]}`;
        }
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        if (unit === 0)
            return tens[ten];
        return `${tens[ten]} y ${units[unit]}`;
    }
    let result = convertInt(integerPart);
    if (decimalPart > 0) {
        result += ` coma ${units[decimalPart] || decimalPart}`;
    }
    return result;
}
const exportCertifiedGrades = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const personId = parseInt(req.query.personId, 10);
        const templateName = req.query.template;
        if (!personId) {
            return res.status(400).json({ message: 'personId es obligatorio' });
        }
        if (!templateName) {
            return res.status(400).json({ message: 'template es obligatorio' });
        }
        const { buffer, fileName } = yield generateCertifiedExcel(personId, templateName);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportCertifiedGrades] Error:', error);
        res.status(500).json({ message: error.message || 'Error al exportar notas certificadas' });
    }
});
exports.exportCertifiedGrades = exportCertifiedGrades;
/**
 * Export certified grades for all students in a grade+section as a single
 * Excel file with one worksheet per student (so they can be printed in a
 * batch). Each worksheet is a copy of the template filled with that
 * student's data.
 */
const exportCertifiedGradesBySection = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const schoolPeriodId = parseInt(req.query.schoolPeriodId, 10);
        const gradeId = parseInt(req.query.gradeId, 10);
        const sectionId = parseInt(req.query.sectionId, 10);
        const templateName = req.query.template;
        if (!schoolPeriodId || !gradeId || !sectionId) {
            return res.status(400).json({ message: 'schoolPeriodId, gradeId y sectionId son obligatorios' });
        }
        if (!templateName) {
            return res.status(400).json({ message: 'template es obligatorio' });
        }
        // Find all students inscribed in this grade+section+period, sorted by canonical list order
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId, gradeId, sectionId },
            include: [
                { model: index_1.Person, as: 'student' },
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Section, as: 'section' },
            ],
        });
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        if (inscriptions.length === 0) {
            return res.status(404).json({ message: 'No hay estudiantes inscritos en esta sección' });
        }
        const sectionName = ((_a = (yield index_1.Section.findByPk(sectionId))) === null || _a === void 0 ? void 0 : _a.name) || 'seccion';
        const gradeName = ((_b = (yield index_1.Grade.findByPk(gradeId))) === null || _b === void 0 ? void 0 : _b.name) || 'grado';
        // If only one student, send a single-student Excel directly
        if (inscriptions.length === 1) {
            const person = inscriptions[0].student;
            const { buffer, fileName } = yield generateCertifiedExcel(person.id, templateName);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
            res.send(buffer);
            return;
        }
        // Multiple students: build a single workbook with one worksheet per student.
        // We build each student's workbook separately, then copy the filled
        // worksheet into a combined workbook.
        const combinedWorkbook = new exceljs_1.default.Workbook();
        let addedCount = 0;
        const usedNames = new Set();
        // Pre-extract images from the template (same for all students).
        // We read the template once to get image buffers + anchors, then register
        // them in the combined workbook so they can be re-inserted on each sheet.
        let templateImages = [];
        let templatePageSetup = null;
        try {
            const templatePath = path_1.default.join(__dirname, '../../templates', templateName);
            const tmpWb = new exceljs_1.default.Workbook();
            yield tmpWb.xlsx.readFile(templatePath);
            const tmpSheet = tmpWb.worksheets[0];
            if (tmpSheet) {
                const imgs = tmpSheet.getImages();
                const media = ((_c = tmpWb.model) === null || _c === void 0 ? void 0 : _c.media) || [];
                for (const img of imgs) {
                    const m = media[img.imageId];
                    if (m && m.buffer) {
                        templateImages.push({
                            buffer: m.buffer,
                            extension: m.extension || 'png',
                            range: img.range,
                        });
                    }
                }
                if (tmpSheet.pageSetup) {
                    templatePageSetup = JSON.parse(JSON.stringify(tmpSheet.pageSetup));
                }
            }
        }
        catch (e) {
            console.warn('[exportCertifiedGradesBySection] Could not extract template images/pageSetup:', e.message);
        }
        // Pre-register images in the combined workbook (once)
        const combinedImageIds = [];
        for (const ti of templateImages) {
            try {
                const id = combinedWorkbook.addImage({ buffer: ti.buffer, extension: ti.extension });
                combinedImageIds.push(id);
            }
            catch (_d) {
                combinedImageIds.push(-1);
            }
        }
        for (const ins of inscriptions) {
            const person = ins.student;
            if (!person)
                continue;
            try {
                const { workbook: studentWb } = yield buildCertifiedWorkbook(person.id, templateName);
                const srcSheet = studentWb.worksheets[0];
                if (!srcSheet)
                    continue;
                // Build a unique worksheet name (Excel limits to 31 chars)
                let baseName = `${person.lastName || ''} ${person.firstName || ''}`.trim();
                if (!baseName)
                    baseName = `Estudiante ${person.id}`;
                let sheetName = baseName.substring(0, 31);
                let suffix = 2;
                while (usedNames.has(sheetName)) {
                    const s = String(suffix);
                    sheetName = `${baseName.substring(0, 31 - s.length)} ${s}`;
                    suffix++;
                }
                usedNames.add(sheetName);
                // Copy the worksheet into the combined workbook
                const newSheet = combinedWorkbook.addWorksheet(sheetName);
                // Copy column widths
                srcSheet.columns.forEach((col, i) => {
                    if (col.width) {
                        const targetCol = newSheet.getColumn(i + 1);
                        targetCol.width = col.width;
                    }
                });
                // Copy row-by-row (values + styles)
                srcSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                    const newRow = newSheet.getRow(rowNumber);
                    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                        const newCell = newRow.getCell(colNumber);
                        newCell.value = cell.value;
                        if (cell.style) {
                            try {
                                newCell.style = JSON.parse(JSON.stringify(cell.style));
                            }
                            catch ( /* ignore style copy errors */_a) { /* ignore style copy errors */ }
                        }
                    });
                    // Copy row dimensions
                    if (row.height)
                        newRow.height = row.height;
                });
                // Copy merged cells
                const merges = srcSheet._merges;
                if (merges) {
                    for (const key of Object.keys(merges)) {
                        const merge = merges[key];
                        if (merge && merge.model && merge.model.top && merge.model.left && merge.model.bottom && merge.model.right) {
                            newSheet.mergeCells(merge.model.top, merge.model.left, merge.model.bottom, merge.model.right);
                        }
                    }
                }
                // Copy page setup from template
                if (templatePageSetup) {
                    newSheet.pageSetup = JSON.parse(JSON.stringify(templatePageSetup));
                }
                // Re-insert images (logo) with the template's anchors
                const makeAnchor = (a) => ({
                    nativeCol: a.nativeCol,
                    nativeColOff: a.nativeColOff,
                    nativeRow: a.nativeRow,
                    nativeRowOff: a.nativeRowOff,
                });
                for (let i = 0; i < templateImages.length; i++) {
                    if (combinedImageIds[i] < 0)
                        continue;
                    const ti = templateImages[i];
                    newSheet.addImage(combinedImageIds[i], {
                        tl: makeAnchor(ti.range.tl),
                        br: makeAnchor(ti.range.br),
                        editAs: ti.range.editAs,
                    });
                }
                addedCount++;
            }
            catch (err) {
                console.error(`[exportCertifiedGradesBySection] Skip student ${person.id}:`, err.message);
            }
        }
        if (addedCount === 0) {
            return res.status(500).json({ message: 'No se pudo generar ningún archivo' });
        }
        const buffer = yield combinedWorkbook.xlsx.writeBuffer();
        const fileName = `notas-certificadas-${gradeName}-${sectionName}.xlsx`.replace(/\s+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportCertifiedGradesBySection] Error:', error);
        res.status(500).json({ message: error.message || 'Error al exportar notas certificadas por sección' });
    }
});
exports.exportCertifiedGradesBySection = exportCertifiedGradesBySection;
/**
 * Core logic: build a certified grades workbook for a single student.
 * Returns the configured ExcelJS workbook (not yet serialized) and the
 * student's person record so callers can rename worksheets or combine
 * multiple students into a single workbook.
 */
function buildCertifiedWorkbook(personId, templateName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
        const templatePath = path_1.default.join(__dirname, '../../templates', templateName);
        if (!fs_1.default.existsSync(templatePath)) {
            throw new Error(`Plantilla no encontrada: ${templateName}`);
        }
        const person = yield index_1.Person.findByPk(personId, {
            include: [{ model: index_1.PersonResidence, as: 'residence' }],
        });
        if (!person) {
            throw new Error('Estudiante no encontrado');
        }
        const settingsRows = yield index_1.Setting.findAll();
        const settings = {};
        settingsRows.forEach((s) => { settings[s.key] = s.value; });
        let plantel = null;
        if (settings.institution_dea_code) {
            plantel = yield index_1.Plantel.findOne({ where: { code: settings.institution_dea_code } });
        }
        // ── Load consolidated grades (same logic as historicalGradesController) ──
        // 1. Get all grade records (years 1-5)
        const allGrades = yield index_1.Grade.findAll({
            attributes: ['id', 'name', 'order'],
            order: [['order', 'ASC']],
        });
        // 2. Get all school periods (for period labels)
        const allPeriods = yield index_1.SchoolPeriod.findAll({
            attributes: ['id', 'startYear', 'endYear', 'period', 'name', 'status'],
            order: [['startYear', 'ASC']],
        });
        const periodShortMap = new Map();
        for (const p of allPeriods) {
            const s = String(p.startYear).slice(-2);
            const e = String(p.endYear).slice(-2);
            periodShortMap.set(p.id, `${s}/${e}`);
        }
        // 2b. Find the active period (for subject lookup)
        const activePeriod = allPeriods.find((p) => p.status === 'activo');
        const activePeriodId = (activePeriod === null || activePeriod === void 0 ? void 0 : activePeriod.id) || null;
        // 2c. Load subjects in canonical order for each grade.
        //     Non-literal, non-group subjects go into subjectsByGrade.
        //     Literal, non-group subjects go into literalSubjectsByGrade.
        //     Group subjects (collapsed by subjectGroupId) go into groupSubjectsByGrade.
        //     Try active period first; if no PeriodGrade, try any period.
        const subjectsByGrade = new Map();
        const literalSubjectsByGrade = new Map();
        const groupSubjectsByGrade = new Map();
        for (const gr of allGrades) {
            let pg = activePeriodId
                ? yield index_1.PeriodGrade.findOne({ where: { schoolPeriodId: activePeriodId, gradeId: gr.id }, attributes: ['id'] })
                : null;
            if (!pg) {
                pg = yield index_1.PeriodGrade.findOne({ where: { gradeId: gr.id }, attributes: ['id'], order: [['id', 'DESC']] });
            }
            if (!pg) {
                subjectsByGrade.set(gr.id, []);
                literalSubjectsByGrade.set(gr.id, []);
                groupSubjectsByGrade.set(gr.id, []);
                continue;
            }
            const pgs = yield index_1.PeriodGradeSubject.findAll({
                where: { periodGradeId: pg.id },
                include: [{
                        model: index_1.Subject,
                        as: 'subject',
                        attributes: ['id', 'name', 'subjectGroupId', 'usesLiteralGrades'],
                        include: [{ model: index_1.SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }],
                    }],
                order: [['order', 'ASC']],
            });
            const subjects = [];
            const literalSubjects = [];
            const groupSubjects = [];
            const groupIndexByGroupId = new Map();
            for (const p of pgs) {
                const subj = p.subject;
                if (!subj)
                    continue;
                const groupId = (_a = subj.subjectGroupId) !== null && _a !== void 0 ? _a : null;
                if (groupId !== null) {
                    // Collapse group subjects by subjectGroupId
                    if (groupIndexByGroupId.has(groupId)) {
                        const idx = groupIndexByGroupId.get(groupId);
                        groupSubjects[idx].memberIds.push(subj.id);
                    }
                    else {
                        groupIndexByGroupId.set(groupId, groupSubjects.length);
                        groupSubjects.push({
                            name: ((_b = subj.subjectGroup) === null || _b === void 0 ? void 0 : _b.name) || subj.name,
                            subjectGroupId: groupId,
                            memberIds: [subj.id],
                        });
                    }
                }
                else if (subj.usesLiteralGrades) {
                    literalSubjects.push({ id: subj.id, name: subj.name });
                }
                else {
                    subjects.push({ id: subj.id, name: subj.name });
                }
            }
            subjectsByGrade.set(gr.id, subjects);
            literalSubjectsByGrade.set(gr.id, literalSubjects);
            groupSubjectsByGrade.set(gr.id, groupSubjects);
        }
        // 3. Get all inscriptions for this student (across all periods, including MP)
        const allInscriptions = yield index_1.Inscription.findAll({
            where: { personId },
            include: [
                { model: index_1.SchoolPeriod, as: 'period', attributes: ['id', 'period', 'name', 'startYear', 'endYear', 'status'] },
                { model: index_1.Grade, as: 'grade', attributes: ['id', 'name', 'order'] },
                { model: index_1.Section, as: 'section', attributes: ['id', 'name'] },
            ],
        });
        const allInsIds = allInscriptions.map(i => i.id);
        // 4. Get InscriptionSubjects + SubjectFinalGrades (all grade types) + SubjectTermGrades
        const insSubjects = yield index_1.InscriptionSubject.findAll({
            where: { inscriptionId: allInsIds },
            include: [
                { model: index_1.Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId', 'usesLiteralGrades'] },
                {
                    model: index_1.Inscription,
                    as: 'inscription',
                    attributes: ['id', 'personId', 'schoolPeriodId', 'gradeId', 'sectionId'],
                },
                {
                    model: index_1.SubjectFinalGrade,
                    as: 'finalGrade',
                    include: [{ model: index_1.Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state'] }],
                },
                { model: index_1.SubjectTermGrade, as: 'termGrades' },
            ],
        });
        // Resolve the last-lapso subject choice for each student/group. The
        // historical InscriptionSubject rows remain present, so selecting the
        // first memberId is not reliable when a student switched groups.
        const latestGroupChoiceByInscription = new Map();
        const latestChoices = yield index_1.InscriptionGroupTermChoice.findAll({
            where: { inscriptionId: allInsIds },
            include: [{ model: index_1.Term, as: 'term', attributes: ['id', 'order'] }],
            attributes: ['inscriptionId', 'subjectGroupId', 'subjectId', 'termId'],
        });
        const latestTermOrderByChoice = new Map();
        const choicesByInscriptionGroup = new Map();
        for (const choice of latestChoices) {
            const key = `${choice.inscriptionId}__${choice.subjectGroupId}`;
            const groupChoices = choicesByInscriptionGroup.get(key) || [];
            groupChoices.push(choice);
            choicesByInscriptionGroup.set(key, groupChoices);
            const order = Number(((_c = choice.term) === null || _c === void 0 ? void 0 : _c.order) || 0);
            if (!latestTermOrderByChoice.has(key) || order > latestTermOrderByChoice.get(key)) {
                latestTermOrderByChoice.set(key, order);
                latestGroupChoiceByInscription.set(key, choice.subjectId);
            }
        }
        const termsByPeriodForGroups = new Map();
        for (const periodId of [...new Set(allInscriptions.map(ins => ins.schoolPeriodId))]) {
            termsByPeriodForGroups.set(periodId, yield index_1.Term.findAll({
                where: { schoolPeriodId: periodId },
                order: [['order', 'ASC']],
            }));
        }
        // 5. Build grades list from InscriptionSubjects
        const gradesMap = [];
        for (const is of insSubjects) {
            const ins = is.inscription;
            const subj = is.subject;
            const fg = is.finalGrade;
            const termGrades = is.termGrades || [];
            if (!ins || !subj)
                continue;
            let finalScore = (fg === null || fg === void 0 ? void 0 : fg.finalScore) != null ? (0, gradeEvaluationService_1.roundGrade)(Number(fg.finalScore)) : null;
            let status = (_d = fg === null || fg === void 0 ? void 0 : fg.status) !== null && _d !== void 0 ? _d : null;
            let gradeType = (_e = fg === null || fg === void 0 ? void 0 : fg.gradeType) !== null && _e !== void 0 ? _e : null;
            let date = (fg === null || fg === void 0 ? void 0 : fg.calculatedAt) ? (0, councilDateResolver_1.formatDateInCaracas)(fg.calculatedAt) : null;
            let plantelId = (_f = fg === null || fg === void 0 ? void 0 : fg.plantelId) !== null && _f !== void 0 ? _f : null;
            let plantelName = (_h = (_g = fg === null || fg === void 0 ? void 0 : fg.plantel) === null || _g === void 0 ? void 0 : _g.name) !== null && _h !== void 0 ? _h : null;
            let plantelState = (_k = (_j = fg === null || fg === void 0 ? void 0 : fg.plantel) === null || _j === void 0 ? void 0 : _j.state) !== null && _k !== void 0 ? _k : null;
            // Regular grades (F) date comes from the last term's council:
            // Master override -> checklist completedAt. Falls back to calculatedAt.
            if (!fg || gradeType === 'regular') {
                const councilDate = yield (0, councilDateResolver_2.resolveCouncilDate)({
                    schoolPeriodId: ins.schoolPeriodId,
                    sectionId: (_l = ins.sectionId) !== null && _l !== void 0 ? _l : null,
                });
                if (councilDate)
                    date = councilDate;
            }
            // For revision / materia_pendiente, resolve date from opportunity dates / encounter dates
            if (fg && gradeType && (gradeType === 'revision' || gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente')) {
                const resolvedDate = yield (0, gradeDateResolver_1.resolveGradeDate)(is.id, gradeType, (_m = is.sectionId) !== null && _m !== void 0 ? _m : null, subj.id, (_o = ins.gradeId) !== null && _o !== void 0 ? _o : null, (_p = ins.schoolPeriodId) !== null && _p !== void 0 ? _p : null);
                if (resolvedDate)
                    date = resolvedDate;
            }
            // Fallback: compute from term grades if no SubjectFinalGrade exists
            if (!fg && termGrades.length > 0) {
                const sum = termGrades.reduce((acc, tg) => acc + Number(tg.score || 0), 0);
                const avg = sum / termGrades.length;
                finalScore = (0, gradeEvaluationService_1.roundFinalGrade)(avg);
                status = (0, gradeEvaluationService_1.isPassingGrade)(avg, 10) ? 'aprobada' : 'reprobada';
                gradeType = 'regular';
                if (!date) {
                    const latestCalculated = termGrades
                        .map(tg => tg.calculatedAt)
                        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
                    date = latestCalculated ? (0, councilDateResolver_1.formatDateInCaracas)(latestCalculated) : null;
                }
            }
            gradesMap.push({
                personId: ins.personId,
                schoolPeriodId: ins.schoolPeriodId,
                gradeId: (_q = ins.gradeId) !== null && _q !== void 0 ? _q : null,
                subjectId: subj.id,
                subjectGroupId: (_r = subj.subjectGroupId) !== null && _r !== void 0 ? _r : null,
                subjectName: (_s = subj.name) !== null && _s !== void 0 ? _s : null,
                finalScore,
                status,
                gradeType,
                plantelId,
                plantelName,
                plantelState,
                date,
                source: 'system',
            });
        }
        // 6. Get HistoricalGrade records (legacy data entered manually)
        const historicalGrades = yield index_1.HistoricalGrade.findAll({
            where: { personId },
            include: [
                { model: index_1.Subject, as: 'subject', attributes: ['id', 'name', 'abbreviation', 'subjectGroupId'] },
                { model: index_1.Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state'] },
            ],
        });
        for (const hg of historicalGrades) {
            const subj = hg.subject;
            gradesMap.push({
                personId: hg.personId,
                schoolPeriodId: (_t = hg.schoolPeriodId) !== null && _t !== void 0 ? _t : null,
                gradeId: hg.gradeId,
                subjectId: hg.subjectId,
                subjectGroupId: (_u = subj === null || subj === void 0 ? void 0 : subj.subjectGroupId) !== null && _u !== void 0 ? _u : null,
                subjectName: hg.subjectName || ((_v = subj === null || subj === void 0 ? void 0 : subj.name) !== null && _v !== void 0 ? _v : null),
                finalScore: hg.finalScore != null ? (0, gradeEvaluationService_1.roundGrade)(Number(hg.finalScore)) : null,
                status: hg.status,
                gradeType: hg.gradeType,
                plantelId: (_w = hg.plantelId) !== null && _w !== void 0 ? _w : null,
                plantelName: (_y = (_x = hg.plantel) === null || _x === void 0 ? void 0 : _x.name) !== null && _y !== void 0 ? _y : null,
                plantelState: (_0 = (_z = hg.plantel) === null || _z === void 0 ? void 0 : _z.state) !== null && _0 !== void 0 ? _0 : null,
                date: hg.date ? (0, councilDateResolver_1.formatDateInCaracas)(hg.date) : null,
                source: 'historical',
            });
        }
        // 7. Consolidated dedup: priority MP > revision > regular
        const priority = (gt) => {
            if (!gt)
                return 3;
            if (gt === 'materia_pendiente' || gt === 'revision_materia_pendiente')
                return 1;
            if (gt === 'revision')
                return 2;
            return 3;
        };
        const gradeByKey = new Map();
        for (const g of gradesMap) {
            const key = `${g.personId}__${g.gradeId}__${g.subjectId}`;
            const existing = gradeByKey.get(key);
            if (!existing) {
                gradeByKey.set(key, g);
            }
            else {
                const existingPri = priority(existing.gradeType);
                const newPri = priority(g.gradeType);
                if (newPri < existingPri) {
                    gradeByKey.set(key, g);
                }
            }
        }
        const consolidatedGrades = Array.from(gradeByKey.values());
        // 8. Get person-planteles (ordered list)
        const personPlanteles = yield index_1.PersonPlantel.findAll({
            where: { personId },
            order: [['order', 'ASC']],
            include: [{ model: index_1.Plantel, as: 'plantel', attributes: ['id', 'code', 'name', 'state', 'stateCode', 'parish'] }],
        });
        // Build a lookup: gradeId + subjectId -> grade data
        const gradeLookup = new Map();
        for (const g of consolidatedGrades) {
            const key = `${g.gradeId}__${g.subjectId}`;
            gradeLookup.set(key, g);
        }
        // ── Read template and fill ──
        const namedRanges = (0, templateNamedRanges_1.readTemplateNamedRanges)(templatePath);
        const workbook = new exceljs_1.default.Workbook();
        yield workbook.xlsx.readFile(templatePath);
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            throw new Error('La plantilla no tiene hojas');
        }
        const sheetName = sheet.name;
        const setter = (name, value) => {
            if (value === undefined || value === null || value === '')
                return;
            const ref = namedRanges.getCell(sheetName, name);
            if (ref) {
                sheet.getCell(ref.cell).value = value;
            }
        };
        const residence = person.residence;
        // ── Cells (only fill what is confirmed by the user) ──
        // T2 = Código de modalidad de estudios (mayúsculas)
        setter('inst_modality_code', (settings.institution_code || '').toUpperCase());
        // B6 = Código de la institución (DEA) (mayúsculas)
        setter('inst_code', (settings.institution_dea_code || (plantel === null || plantel === void 0 ? void 0 : plantel.code) || '').toUpperCase());
        // N3 = Parroquia de la institución + ", " + fecha actual (ej: "ALTAGRACIA DE ORITUCO, 30 DE DICIEMBRE DE 2023")
        const parish = (settings.institution_parish || '').toUpperCase();
        const dateStr = formatDateES(new Date()).toUpperCase();
        setter('expedition_place_date', parish ? `${parish}, ${dateStr}` : dateStr);
        // ── Institution ──
        // I6 = Nombre de la institución
        setter('inst_name', (settings.institution_name || (plantel === null || plantel === void 0 ? void 0 : plantel.name) || '').toUpperCase());
        // C7 = Dirección de la institución
        setter('inst_address', (settings.institution_address || '').toUpperCase());
        // Q7 = Teléfono
        setter('inst_phone', (settings.institution_phone || '').toUpperCase());
        // C8 = Municipio
        setter('inst_municipality', (settings.institution_municipality || (plantel === null || plantel === void 0 ? void 0 : plantel.municipality) || '').toUpperCase());
        // M8 = Estado
        setter('inst_state', (settings.institution_state || (plantel === null || plantel === void 0 ? void 0 : plantel.state) || '').toUpperCase());
        // Q8 = CDCEE
        setter('inst_cdcee', (settings.institution_cdcee || '').toUpperCase());
        // ── Student ──
        // C10 = Cédula en formato "V 00000000"
        const docType = person.documentType === 'Extranjero' ? 'E' :
            person.documentType === 'Pasaporte' ? 'P' : 'V';
        const docNum = String(person.document || '').replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
        setter('student_doc', docNum ? `${docType} ${docNum}` : '');
        // M10 = Fecha de nacimiento del estudiante
        setter('student_birthdate', person.birthdate ? formatBirthdateES(person.birthdate).toUpperCase() : '');
        // B11 = Apellidos del estudiante
        setter('student_lastname', (person.lastName || '').toUpperCase());
        // M11 = Nombres del estudiante
        setter('student_firstname', (person.firstName || '').toUpperCase());
        // D12 = País de nacimiento del estudiante
        setter('student_birth_country', 'VENEZUELA');
        // J12 = Estado de nacimiento del estudiante
        setter('student_birth_state', ((residence === null || residence === void 0 ? void 0 : residence.birthState) || '').toUpperCase());
        // O12 = Municipio de nacimiento del estudiante
        setter('student_birth_municipality', ((residence === null || residence === void 0 ? void 0 : residence.birthMunicipality) || '').toUpperCase());
        // ── Planteles (up to 5) ──
        // Build the list from PersonPlantel (ordered). Each plantel has name, parish, stateCode.
        // For the system's own institution (if not in the plantel list), use
        // settings.institution_parish and first 2 letters of the state.
        // plantelId: null = system institution, otherwise the Plantel.id
        const SYSTEM_PLANTEL_ID = -1;
        const plantelesList = [];
        for (const pp of personPlanteles) {
            const p = pp.plantel;
            if (!p)
                continue;
            plantelesList.push({
                plantelId: p.id,
                name: p.name || '',
                parish: p.parish || '',
                stateCode: p.stateCode || (p.state ? p.state.substring(0, 2).toUpperCase() : ''),
            });
        }
        // If the system's own institution is not already in the list, add it
        const ownInstName = (settings.institution_name || (plantel === null || plantel === void 0 ? void 0 : plantel.name) || '').toUpperCase();
        const ownInstInList = plantelesList.some(p => p.name.toUpperCase() === ownInstName);
        if (!ownInstInList && ownInstName) {
            const ownState = (settings.institution_state || (plantel === null || plantel === void 0 ? void 0 : plantel.state) || '').toUpperCase();
            plantelesList.push({
                plantelId: SYSTEM_PLANTEL_ID,
                name: ownInstName,
                parish: (settings.institution_parish || '').toUpperCase(),
                stateCode: ownState ? ownState.substring(0, 2) : '',
            });
        }
        // Write up to 5 planteles
        for (let i = 0; i < Math.min(plantelesList.length, 5); i++) {
            const p = plantelesList[i];
            setter(`plantel_${i + 1}_name`, p.name.toUpperCase());
            setter(`plantel_${i + 1}_parish`, p.parish.toUpperCase());
            setter(`plantel_${i + 1}_state`, p.stateCode.toUpperCase());
        }
        // Helper: resolve plantel index (1-based) for a grade
        const resolvePlantelIndex = (g) => {
            // System grades or null plantelId → system institution
            if (g.source === 'system' || g.plantelId == null) {
                const idx = plantelesList.findIndex(p => p.plantelId === SYSTEM_PLANTEL_ID);
                return idx >= 0 ? idx + 1 : 1;
            }
            // Match by plantelId
            const idx = plantelesList.findIndex(p => p.plantelId === g.plantelId);
            if (idx >= 0)
                return idx + 1;
            // Fallback: match by name
            if (g.plantelName) {
                const idxByName = plantelesList.findIndex(p => p.name.toUpperCase() === g.plantelName.toUpperCase());
                if (idxByName >= 0)
                    return idxByName + 1;
            }
            return 1;
        };
        // gradeType → letter code (same as Notas Históricas)
        const GRADE_TYPE_TO_CODE = {
            regular: 'F',
            revision: 'R',
            materia_pendiente: 'P',
            revision_materia_pendiente: 'M',
            transferencia: 'T',
            equivalencia: 'E',
        };
        // Max grade for padding (default 20)
        const maxGrade = Number(settings.max_grade || 20);
        const padDigits = Math.max(2, String(maxGrade).length);
        // Helper: round grade and enforce minimum of 1 (minimum allowed grade)
        const roundGradeMin1 = (score) => (0, gradeEvaluationService_1.roundFinalGrade)(score);
        // Letter grades config (for literal subjects)
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
        // ── Year 1 grades (rows 21-27, 7 subjects) ──
        const year1Grade = allGrades.find((g) => g.order === 1);
        if (year1Grade) {
            const subjects = subjectsByGrade.get(year1Grade.id) || [];
            const maxSubjects = Math.min(subjects.length, 7);
            for (let s = 0; s < maxSubjects; s++) {
                const subj = subjects[s];
                const lookupKey = `${year1Grade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                const subjNum = s + 1;
                // A21-A27 = subject name (title case)
                setter(`y1_s${subjNum}_name`, toTitleCaseES(subj.name));
                if (!g)
                    continue;
                // D21-D27 = grade in numbers (rounded, zero-padded)
                if (g.finalScore != null) {
                    setter(`y1_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
                    // E21-E27 = grade in letters
                    setter(`y1_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
                }
                // G21-G27 = evaluation type letter
                const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
                setter(`y1_s${subjNum}_te`, teCode);
                // H21-H27 = month (00), I21-I27 = year (0000)
                if (g.date) {
                    const parts = g.date.split('-');
                    if (parts.length === 3) {
                        setter(`y1_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
                        setter(`y1_s${subjNum}_year`, parts[0]);
                    }
                }
                // J21-J27 = plantel index (1-based)
                setter(`y1_s${subjNum}_inst`, resolvePlantelIndex(g));
            }
        }
        // ── Literal subjects (8th per year) → P42-P46 (letter grades) ──
        // Year 1 → P42, Year 2 → P43, Year 3 → P44, Year 4 → P45, Year 5 → P46
        const literalCells = ['y1_s8_num', 'y2_s8_num', 'y3_s9_num', 'y4_s10_num', 'y5_s11_num'];
        for (let y = 1; y <= 5; y++) {
            const yearGrade = allGrades.find((g) => g.order === y);
            if (!yearGrade)
                continue;
            const literalSubjects = literalSubjectsByGrade.get(yearGrade.id) || [];
            if (literalSubjects.length > 0) {
                const subj = literalSubjects[0];
                const lookupKey = `${yearGrade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                if (g && g.finalScore != null) {
                    setter(literalCells[y - 1], numericToLetter(roundGradeMin1(g.finalScore), letterGradesConfig).toUpperCase());
                }
            }
        }
        // ── Group subjects → P48-P52 (name), S48 + B49-B52 (letter grade) ──
        // Year 1 → P48/S48, Year 2 → P49/B49, Year 3 → P50/B50, Year 4 → P51/B51, Year 5 → P52/B52
        const groupNameCells = ['y1_group_name', 'y2_group_name', 'y3_group_name', 'y4_group_name', 'y5_group_name'];
        const groupNumCells = ['y1_group_num', 'y2_group_num', 'y3_group_num', 'y4_group_num', 'y5_group_num'];
        for (let y = 1; y <= 5; y++) {
            const yearGrade = allGrades.find((g) => g.order === y);
            if (!yearGrade)
                continue;
            const groupSubjects = groupSubjectsByGrade.get(yearGrade.id) || [];
            if (groupSubjects.length > 0) {
                const grp = groupSubjects[0];
                const studentInscription = allInscriptions.find((ins) => { var _a; return ((_a = ins.grade) === null || _a === void 0 ? void 0 : _a.order) === y; });
                const groupKey = studentInscription
                    ? `${studentInscription.id}__${grp.subjectGroupId}`
                    : null;
                const selectedMemberId = groupKey ? latestGroupChoiceByInscription.get(groupKey) : undefined;
                const memberIds = selectedMemberId != null
                    ? [selectedMemberId, ...grp.memberIds.filter(id => id !== selectedMemberId)]
                    : grp.memberIds;
                for (const memberId of memberIds) {
                    const lookupKey = `${yearGrade.id}__${memberId}`;
                    const g = gradeLookup.get(lookupKey);
                    if (g && g.finalScore != null) {
                        let groupFinalScore = Number(g.finalScore);
                        if (studentInscription && groupKey) {
                            const groupChoices = choicesByInscriptionGroup.get(groupKey) || [];
                            const periodTerms = termsByPeriodForGroups.get(studentInscription.schoolPeriodId) || [];
                            const inscriptionSubjectsForStudent = insSubjects.filter((item) => {
                                var _a, _b;
                                return ((_a = item.inscription) === null || _a === void 0 ? void 0 : _a.id) === studentInscription.id
                                    && ((_b = item.subject) === null || _b === void 0 ? void 0 : _b.subjectGroupId) === grp.subjectGroupId;
                            });
                            const lapsos = periodTerms.map((periodTerm) => {
                                var _a;
                                const choice = groupChoices.find((item) => item.termId === periodTerm.id);
                                const selectedSubject = inscriptionSubjectsForStudent.find((item) => item.subjectId === (choice === null || choice === void 0 ? void 0 : choice.subjectId));
                                const termGrade = (_a = selectedSubject === null || selectedSubject === void 0 ? void 0 : selectedSubject.termGrades) === null || _a === void 0 ? void 0 : _a.find((item) => item.termId === periodTerm.id);
                                return {
                                    termId: periodTerm.id,
                                    finalScore: (termGrade === null || termGrade === void 0 ? void 0 : termGrade.score) != null ? Number(termGrade.score) : null,
                                };
                            });
                            const calculatedGroupScore = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos, null);
                            if (calculatedGroupScore != null)
                                groupFinalScore = calculatedGroupScore;
                        }
                        setter(groupNameCells[y - 1], toTitleCaseES(g.subjectName || grp.name));
                        setter(groupNumCells[y - 1], numericToLetter(roundGradeMin1(groupFinalScore), letterGradesConfig).toUpperCase());
                        break;
                    }
                }
            }
        }
        // ── Year 2 grades (rows 21-27, 7 subjects) ──
        // L=name, O=num, P=letters, Q=te, R=month, S=year, U=inst
        const year2Grade = allGrades.find((g) => g.order === 2);
        if (year2Grade) {
            const subjects = subjectsByGrade.get(year2Grade.id) || [];
            const maxSubjects = Math.min(subjects.length, 7);
            for (let s = 0; s < maxSubjects; s++) {
                const subj = subjects[s];
                const lookupKey = `${year2Grade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                const subjNum = s + 1;
                // L21-L27 = subject name (title case)
                setter(`y2_s${subjNum}_name`, toTitleCaseES(subj.name));
                if (!g)
                    continue;
                // O21-O27 = grade in numbers (rounded, zero-padded)
                if (g.finalScore != null) {
                    setter(`y2_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
                    // P21-P27 = grade in letters
                    setter(`y2_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
                }
                // Q21-Q27 = evaluation type letter
                const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
                setter(`y2_s${subjNum}_te`, teCode);
                // R21-R27 = month (00), S21-S27 = year (0000)
                if (g.date) {
                    const parts = g.date.split('-');
                    if (parts.length === 3) {
                        setter(`y2_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
                        setter(`y2_s${subjNum}_year`, parts[0]);
                    }
                }
                // U21-U27 = plantel index (1-based)
                setter(`y2_s${subjNum}_inst`, resolvePlantelIndex(g));
            }
        }
        // ── Year 3 grades (rows 31-38, 8 subjects) ──
        // A=name, D=num, E=letters, G=te, H=month, I=year, J=inst
        const year3Grade = allGrades.find((g) => g.order === 3);
        if (year3Grade) {
            const subjects = subjectsByGrade.get(year3Grade.id) || [];
            const maxSubjects = Math.min(subjects.length, 8);
            for (let s = 0; s < maxSubjects; s++) {
                const subj = subjects[s];
                const lookupKey = `${year3Grade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                const subjNum = s + 1;
                // A31-A38 = subject name (title case)
                setter(`y3_s${subjNum}_name`, toTitleCaseES(subj.name));
                if (!g)
                    continue;
                // D31-D38 = grade in numbers (rounded, zero-padded)
                if (g.finalScore != null) {
                    setter(`y3_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
                    // E31-E38 = grade in letters
                    setter(`y3_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
                }
                // G31-G38 = evaluation type letter
                const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
                setter(`y3_s${subjNum}_te`, teCode);
                // H31-H38 = month (00), I31-I38 = year (0000)
                if (g.date) {
                    const parts = g.date.split('-');
                    if (parts.length === 3) {
                        setter(`y3_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
                        setter(`y3_s${subjNum}_year`, parts[0]);
                    }
                }
                // J31-J38 = plantel index (1-based)
                setter(`y3_s${subjNum}_inst`, resolvePlantelIndex(g));
            }
        }
        // ── Year 4 grades (rows 31-39, 9 subjects) ──
        // L=name, O=num, P=letters, Q=te, R=month, S=year, U=inst
        const year4Grade = allGrades.find((g) => g.order === 4);
        if (year4Grade) {
            const subjects = subjectsByGrade.get(year4Grade.id) || [];
            const maxSubjects = Math.min(subjects.length, 9);
            for (let s = 0; s < maxSubjects; s++) {
                const subj = subjects[s];
                const lookupKey = `${year4Grade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                const subjNum = s + 1;
                // L31-L39 = subject name (title case)
                setter(`y4_s${subjNum}_name`, toTitleCaseES(subj.name));
                if (!g)
                    continue;
                // O31-O39 = grade in numbers (rounded, zero-padded)
                if (g.finalScore != null) {
                    setter(`y4_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
                    // P31-P39 = grade in letters
                    setter(`y4_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
                }
                // Q31-Q39 = evaluation type letter
                const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
                setter(`y4_s${subjNum}_te`, teCode);
                // R31-R39 = month (00), S31-S39 = year (0000)
                if (g.date) {
                    const parts = g.date.split('-');
                    if (parts.length === 3) {
                        setter(`y4_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
                        setter(`y4_s${subjNum}_year`, parts[0]);
                    }
                }
                // U31-U39 = plantel index (1-based)
                setter(`y4_s${subjNum}_inst`, resolvePlantelIndex(g));
            }
        }
        // ── Year 5 grades (rows 43-52, 10 subjects) ──
        // A=name, D=num, E=letters, G=te, H=month, I=year, J=inst
        const year5Grade = allGrades.find((g) => g.order === 5);
        if (year5Grade) {
            const subjects = subjectsByGrade.get(year5Grade.id) || [];
            const maxSubjects = Math.min(subjects.length, 10);
            for (let s = 0; s < maxSubjects; s++) {
                const subj = subjects[s];
                const lookupKey = `${year5Grade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                const subjNum = s + 1;
                // A43-A52 = subject name (title case)
                setter(`y5_s${subjNum}_name`, toTitleCaseES(subj.name));
                if (!g)
                    continue;
                // D43-D52 = grade in numbers (rounded, zero-padded)
                if (g.finalScore != null) {
                    setter(`y5_s${subjNum}_num`, String(roundGradeMin1(g.finalScore)).padStart(padDigits, '0'));
                    // E43-E52 = grade in letters
                    setter(`y5_s${subjNum}_letters`, numberToSpanishWords(roundGradeMin1(g.finalScore)).toUpperCase());
                }
                // G43-G52 = evaluation type letter
                const teCode = g.gradeType ? (GRADE_TYPE_TO_CODE[g.gradeType] || 'F') : 'F';
                setter(`y5_s${subjNum}_te`, teCode);
                // H43-H52 = month (00), I43-I52 = year (0000)
                if (g.date) {
                    const parts = g.date.split('-');
                    if (parts.length === 3) {
                        setter(`y5_s${subjNum}_month`, padNumber(parseInt(parts[1], 10)));
                        setter(`y5_s${subjNum}_year`, parts[0]);
                    }
                }
                // J43-J52 = plantel index (1-based)
                setter(`y5_s${subjNum}_inst`, resolvePlantelIndex(g));
            }
        }
        // ── Overall average (S53) ──
        // Average of all numeric (non-literal) grades across all 5 years.
        const allNumericScores = [];
        for (let y = 1; y <= 5; y++) {
            const yearGrade = allGrades.find((g) => g.order === y);
            if (!yearGrade)
                continue;
            const subjects = subjectsByGrade.get(yearGrade.id) || [];
            for (const subj of subjects) {
                const lookupKey = `${yearGrade.id}__${subj.id}`;
                const g = gradeLookup.get(lookupKey);
                if (g && g.finalScore != null) {
                    allNumericScores.push(roundGradeMin1(g.finalScore));
                }
            }
        }
        if (allNumericScores.length > 0) {
            const avg = allNumericScores.reduce((a, b) => a + b, 0) / allNumericScores.length;
            setter('overall_average', avg.toFixed(2));
        }
        // ── Director (A58 = name, A60 = cédula) ──
        // If director_first_names and director_last_names are set, use "APELLIDOS, Nombres" format.
        // Otherwise fall back to director_name.
        const directorFirstNames = (settings.director_first_names || '').trim();
        const directorLastNames = (settings.director_last_names || '').trim();
        let directorDisplay = '';
        if (directorLastNames && directorFirstNames) {
            directorDisplay = `${directorLastNames}, ${directorFirstNames}`;
        }
        else {
            directorDisplay = settings.director_name || '';
        }
        setter('director_name', directorDisplay.toUpperCase());
        const directorDocRaw = settings.director_document || '';
        const directorDocNum = directorDocRaw.replace(/^(V|E|P|CE)\s*[-.]?\s*/i, '');
        const directorDocType = /^e/i.test(directorDocRaw) ? 'E' : /^p/i.test(directorDocRaw) ? 'P' : 'V';
        setter('director_doc', directorDocNum ? `${directorDocType} ${directorDocNum}` : '');
        return { workbook, person };
    });
}
/**
 * Generate a certified grades Excel buffer for a single student.
 */
function generateCertifiedExcel(personId, templateName) {
    return __awaiter(this, void 0, void 0, function* () {
        const { workbook, person } = yield buildCertifiedWorkbook(personId, templateName);
        const buffer = yield workbook.xlsx.writeBuffer();
        const fileName = `notas-certificadas-${person.lastName}-${person.firstName}.xlsx`.replace(/\s+/g, '_');
        return { buffer: Buffer.from(buffer), fileName };
    });
}
const getCertifiedGradesData = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        const personId = parseInt(req.query.personId, 10);
        if (!personId) {
            return res.status(400).json({ message: 'personId es obligatorio' });
        }
        const person = yield index_1.Person.findByPk(personId, {
            include: [{ model: index_1.PersonResidence, as: 'residence' }],
        });
        if (!person) {
            return res.status(404).json({ message: 'Estudiante no encontrado' });
        }
        const settingsRows = yield index_1.Setting.findAll();
        const settings = {};
        settingsRows.forEach((s) => { settings[s.key] = s.value; });
        let plantel = null;
        if (settings.institution_dea_code) {
            plantel = yield index_1.Plantel.findOne({ where: { code: settings.institution_dea_code } });
        }
        const inscriptions = yield index_1.Inscription.findAll({
            where: { personId },
            include: [
                { model: index_1.SchoolPeriod, as: 'period' },
                { model: index_1.Grade, as: 'grade' },
                { model: index_1.Section, as: 'section' },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    include: [
                        { model: index_1.Subject, as: 'subject', include: [{ model: index_1.SubjectGroup, as: 'subjectGroup' }] },
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade', where: { gradeType: 'regular' }, required: false, include: [{ model: index_1.Plantel, as: 'plantel' }] },
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
                [{ model: index_1.SchoolPeriod, as: 'period' }, 'period', 'ASC'],
                [{ model: index_1.Grade, as: 'grade' }, 'order', 'ASC'],
            ],
        });
        const allPeriodIds = [...new Set(inscriptions.map((ins) => ins.schoolPeriodId))];
        const termsByPeriod = {};
        const subjectOrderByPeriod = {};
        const councilDoneByPeriod = {};
        for (const periodId of allPeriodIds) {
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId: periodId },
                order: [['order', 'ASC']],
            });
            termsByPeriod[periodId] = terms;
            const firstIns = inscriptions.find((ins) => ins.schoolPeriodId === periodId);
            if (firstIns) {
                const pg = yield index_1.PeriodGrade.findOne({
                    where: { schoolPeriodId: periodId, gradeId: firstIns.gradeId },
                });
                subjectOrderByPeriod[periodId] = pg ? yield (0, subjectOrderService_1.getSubjectOrderMap)(pg.id) : new Map();
            }
            // Query CouncilChecklist for this period
            const councilChecklists = yield index_1.CouncilChecklist.findAll({
                where: {
                    schoolPeriodId: periodId,
                    status: 'done',
                    termId: terms.map((t) => t.id),
                },
                attributes: ['termId', 'sectionId', 'status'],
            });
            councilDoneByPeriod[periodId] = gradeCalculationService_1.GradeCalculationService.buildCouncilDoneChecker(councilChecklists.map((c) => ({ termId: c.termId, sectionId: c.sectionId, status: c.status })));
        }
        // Precompute the official council date (override -> checklist) per inscription
        const councilDateByIns = new Map();
        for (const ins of inscriptions) {
            councilDateByIns.set(ins.id, yield (0, councilDateResolver_2.resolveCouncilDate)({
                schoolPeriodId: ins.schoolPeriodId,
                sectionId: (_c = (_b = (_a = ins.section) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : ins.sectionId) !== null && _c !== void 0 ? _c : null,
            }));
        }
        const years = inscriptions.map((ins) => {
            var _a, _b, _c, _d, _e;
            const terms = termsByPeriod[ins.schoolPeriodId] || [];
            const termCount = terms.length || 1;
            const orderMap = subjectOrderByPeriod[ins.schoolPeriodId] || new Map();
            const activeInscriptionSubjects = (0, subjectGroupService_1.filterActiveGroupSubjects)(ins.inscriptionSubjects || []);
            const insSubs = (0, subjectOrderService_1.sortSubjectsByOrder)(activeInscriptionSubjects.filter((is) => { var _a; return !((_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId); }), (is) => is.subjectId, (is) => { var _a; return ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.name) || ''; }, orderMap);
            const groupSubjects = activeInscriptionSubjects
                .filter((is) => { var _a; return (_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId; })
                .map((is) => { var _a; return ((_a = is.subject) === null || _a === void 0 ? void 0 : _a.name) || ''; })
                .filter(Boolean);
            const subjects = insSubs.map((is) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                const studentSectionId = ((_a = ins.section) === null || _a === void 0 ? void 0 : _a.id) || 0;
                const isCouncilDone = councilDoneByPeriod[ins.schoolPeriodId] || (() => false);
                // Build term grades with fallback to qualifications + councilPoints
                const termGradesArr = gradeCalculationService_1.GradeCalculationService.buildTermGradesWithFallback((is.termGrades || []).map((tg) => ({ termId: tg.termId, score: Number(tg.score) })), is.qualifications || [], is.councilPoints || [], terms.map((t) => t.id));
                // Build lapsos using the service
                const lapsos = terms.map((t) => {
                    const councilDone = isCouncilDone(t.id, studentSectionId);
                    const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalTermScore(t.id, termGradesArr, councilDone);
                    return { termId: t.id, termName: t.name, score: finalScore };
                });
                // Calculate finalScore using the service
                const finalScore = gradeCalculationService_1.GradeCalculationService.calculateFinalScore(lapsos.map((l) => ({ termId: l.termId, finalScore: l.score })), is.finalGrade ? { finalScore: is.finalGrade.finalScore, gradeType: is.finalGrade.gradeType } : null);
                return {
                    id: is.subjectId,
                    name: ((_b = is.subject) === null || _b === void 0 ? void 0 : _b.name) || '',
                    usesLiteralGrades: ((_c = is.subject) === null || _c === void 0 ? void 0 : _c.usesLiteralGrades) || false,
                    lapsos,
                    finalScore,
                    originInstitution: (_f = (_e = (_d = is.finalGrade) === null || _d === void 0 ? void 0 : _d.plantel) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : null,
                    originInstitutionCode: (_j = (_h = (_g = is.finalGrade) === null || _g === void 0 ? void 0 : _g.plantel) === null || _h === void 0 ? void 0 : _h.code) !== null && _j !== void 0 ? _j : null,
                    originInstitutionState: (_m = (_l = (_k = is.finalGrade) === null || _k === void 0 ? void 0 : _k.plantel) === null || _l === void 0 ? void 0 : _l.state) !== null && _m !== void 0 ? _m : null,
                    gradeType: (_p = (_o = is.finalGrade) === null || _o === void 0 ? void 0 : _o.gradeType) !== null && _p !== void 0 ? _p : null,
                    issuedAt: (() => {
                        var _a, _b, _c, _d, _e;
                        const gt = (_a = is.finalGrade) === null || _a === void 0 ? void 0 : _a.gradeType;
                        // Regular (or missing) final grades take the official council date
                        if (gt && gt !== 'regular')
                            return (_c = (_b = is.finalGrade) === null || _b === void 0 ? void 0 : _b.calculatedAt) !== null && _c !== void 0 ? _c : null;
                        return councilDateByIns.get(ins.id) || ((_e = (_d = is.finalGrade) === null || _d === void 0 ? void 0 : _d.calculatedAt) !== null && _e !== void 0 ? _e : null);
                    })(),
                };
            });
            return {
                periodName: ((_a = ins.period) === null || _a === void 0 ? void 0 : _a.name) || ((_b = ins.period) === null || _b === void 0 ? void 0 : _b.period) || '',
                gradeName: ((_c = ins.grade) === null || _c === void 0 ? void 0 : _c.name) || '',
                sectionName: ((_d = ins.section) === null || _d === void 0 ? void 0 : _d.name) || '',
                isExternal: ((_e = ins.period) === null || _e === void 0 ? void 0 : _e.isExternal) === true,
                terms: terms.map((t) => ({ id: t.id, name: t.name, order: t.order })),
                groupSubjects,
                subjects,
            };
        });
        const residence = person.residence;
        res.json({
            institution: {
                code: settings.institution_dea_code || (plantel === null || plantel === void 0 ? void 0 : plantel.code) || '',
                name: settings.institution_name || (plantel === null || plantel === void 0 ? void 0 : plantel.name) || '',
                educationCode: settings.institution_code || '',
                educationType: settings.institution_level || '',
                address: settings.institution_address || '',
                municipality: settings.institution_municipality || (plantel === null || plantel === void 0 ? void 0 : plantel.municipality) || '',
                phone: settings.institution_phone || '',
                state: (plantel === null || plantel === void 0 ? void 0 : plantel.state) || '',
                cdcee: settings.institution_cdcee || '',
            },
            student: {
                id: person.id,
                firstName: person.firstName || '',
                lastName: person.lastName || '',
                document: person.document || '',
                birthdate: person.birthdate ? formatBirthdateES(person.birthdate) : '',
                birthCountry: 'Venezuela',
                birthState: (residence === null || residence === void 0 ? void 0 : residence.birthState) || '',
                birthMunicipality: (residence === null || residence === void 0 ? void 0 : residence.birthMunicipality) || '',
            },
            expeditionDate: formatDateES(new Date()),
            years,
        });
    }
    catch (error) {
        console.error('[getCertifiedGradesData] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener datos de notas certificadas' });
    }
});
exports.getCertifiedGradesData = getCertifiedGradesData;
/**
 * Format a document number to include the "V" / "E" / "P" prefix.
 * e.g. "8417321" → "V 8417321", "V-8417321" → "V 8417321", "V 8417321" → "V 8417321"
 */
function formatDocument(raw) {
    if (!raw)
        return '';
    const trimmed = raw.trim();
    // If already has a letter prefix, normalize spacing
    const match = trimmed.match(/^([VEPvep])\s*[-.]?\s*(.+)$/);
    if (match) {
        return `${match[1].toUpperCase()} ${match[2].trim()}`;
    }
    // No prefix — assume "V" (Venezolano) by default
    return `V ${trimmed}`;
}
/**
 * Export the "reverso" (back side) of certified grades as an Excel file.
 * This is a generic document — same for everyone — with optional sections
 * controlled by boolean flags:
 *   - includeDirector: show Director signature block (from settings)
 *   - includeCoordinator: show Coordinador de Control de Estudios block (from settings)
 *   - includeFuncionario: show Funcionario designado block (from query params)
 *   - includeDeclaracion: show "COPIA FIEL Y EXACTA DEL ORIGINAL" declaration
 *
 * Query params:
 *   includeDirector=true/false
 *   includeCoordinator=true/false
 *   includeFuncionario=true/false
 *   funcionarioName=string
 *   funcionarioDocument=string
 *   includeDeclaracion=true/false
 */
const exportReverso = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const includeDirector = req.query.includeDirector === 'true';
        const includeCoordinator = req.query.includeCoordinator === 'true';
        const includeFuncionario = req.query.includeFuncionario === 'true';
        const includeDeclaracion = req.query.includeDeclaracion === 'true';
        const funcionarioName = req.query.funcionarioName || '';
        const funcionarioDocument = req.query.funcionarioDocument || '';
        // Load all settings
        const settingsRows = yield index_1.Setting.findAll();
        const settings = {};
        for (const s of settingsRows) {
            settings[s.key] = s.value;
        }
        // Build director display name (natural order: "Nombres APELLIDOS", matching mockup)
        const directorFirstNames = (settings.director_first_names || '').trim();
        const directorLastNames = (settings.director_last_names || '').trim();
        let directorDisplay = '';
        if (directorFirstNames && directorLastNames) {
            directorDisplay = `${directorFirstNames} ${directorLastNames}`;
        }
        else {
            directorDisplay = settings.director_name || '';
        }
        const directorGender = settings.director_gender === 'F' ? 'F' : 'M';
        const directorLabel = directorGender === 'F' ? 'Directora' : 'Director';
        const directorDoc = formatDocument(settings.director_document || '');
        // Build coordinator display name (natural order: "Nombres APELLIDOS", matching mockup)
        const coordFirstNames = (settings.control_estudios_first_names || '').trim();
        const coordLastNames = (settings.control_estudios_last_names || '').trim();
        let coordinatorDisplay = '';
        if (coordFirstNames && coordLastNames) {
            coordinatorDisplay = `${coordFirstNames} ${coordLastNames}`;
        }
        else {
            coordinatorDisplay = settings.control_estudios_name || '';
        }
        const coordinatorDoc = formatDocument(settings.control_estudios_document || '');
        // Active school period (for "Año Escolar YYYY-YYYY" in funcionario text)
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        const schoolYearLabel = activePeriod
            ? `${activePeriod.startYear}-${activePeriod.endYear}`
            : '______-______';
        // Institution info
        const institutionName = settings.institution_name || '';
        const institutionParish = settings.institution_parish || '';
        // Build the workbook — matching the mockup exactly
        const wb = new exceljs_1.default.Workbook();
        const ws = wb.addWorksheet('Reverso', {
            properties: { defaultRowHeight: 15 },
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'portrait',
                fitToWidth: 1,
                fitToHeight: 1,
                margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
            },
        });
        // Column widths (matching mockup: col1=12, col2=46.57)
        ws.getColumn(1).width = 12;
        ws.getColumn(2).width = 43.43;
        // ── Border styles ──
        const BLACK = { argb: 'FF000000' };
        const mediumBorder = { style: 'medium', color: BLACK };
        const thinBorder = { style: 'thin', color: BLACK };
        // Helper to apply borders to a 2-column row
        // isFirstRowOfBlock: top border is medium (top of the block)
        // isLastRowOfBlock: bottom border is medium (bottom of the block)
        // isMerged: if true, the row is a merged A:B row — only set outer borders
        const applyBorders = (rowNum, isFirst, isLast, isMerged = false) => {
            const c1 = ws.getCell(rowNum, 1);
            const c2 = ws.getCell(rowNum, 2);
            const topB = isFirst ? mediumBorder : thinBorder;
            const bottomB = isLast ? mediumBorder : thinBorder;
            if (isMerged) {
                // For merged cells, set outer borders on each side cell
                // C1 gets left + top + bottom, C2 gets right + top + bottom
                c1.border = { left: mediumBorder, top: topB, bottom: bottomB, right: thinBorder };
                c2.border = { right: mediumBorder, top: topB, bottom: bottomB, left: thinBorder };
                // Re-assert C1 left border after merge (ExcelJS can overwrite it)
                c1.border = Object.assign(Object.assign({}, c1.border), { left: mediumBorder });
            }
            else {
                c1.border = {
                    left: mediumBorder,
                    right: thinBorder,
                    top: topB,
                    bottom: bottomB,
                };
                c2.border = {
                    left: thinBorder,
                    right: mediumBorder,
                    top: topB,
                    bottom: bottomB,
                };
            }
        };
        // Helper to set cell font (Times New Roman, size 9)
        const setFont = (rowNum, col, opts) => {
            const cell = ws.getCell(rowNum, col);
            cell.font = {
                name: 'Times New Roman',
                family: 1,
                size: (opts === null || opts === void 0 ? void 0 : opts.size) || 9,
                bold: (opts === null || opts === void 0 ? void 0 : opts.bold) || false,
                color: (opts === null || opts === void 0 ? void 0 : opts.black) ? { argb: 'FF000000' } : { theme: 1 },
            };
        };
        // Helper to set alignment (justify, like the mockup)
        const setAlign = (rowNum, col, vertical = 'middle', wrapText = true) => {
            const cell = ws.getCell(rowNum, col);
            cell.alignment = { horizontal: 'justify', vertical, wrapText };
        };
        let row = 1;
        // ── Director block ──
        if (includeDirector) {
            // Row 1: Certification text (merged A1:B1) with rich text
            ws.mergeCells(row, 1, row, 2);
            ws.getRow(row).height = 51.75;
            const certCell = ws.getCell(row, 1);
            certCell.value = {
                richText: [
                    { text: 'Quien suscribe, ' },
                    { font: { bold: true, size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: directorDisplay },
                    { font: { size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: ', titular de la cédula de identidad N° ' },
                    { font: { bold: true, size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: directorDoc },
                    { font: { size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: ', ' },
                    { font: { bold: true, size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: `${directorLabel} de la ${institutionName}` },
                    { font: { size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: ', Certifica la Veracidad de los Datos y Calificaciones emitidas en el presente documento.' },
                ],
            };
            setFont(row, 1);
            setAlign(row, 1, 'top');
            applyBorders(row, true, false, true);
            row++;
            // Row 2: Location text (merged A2:B2)
            ws.mergeCells(row, 1, row, 2);
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = ` Verificado en ${institutionParish} a la fecha de emision de este documento`;
            setFont(row, 1);
            setAlign(row, 1, 'middle');
            applyBorders(row, false, false, true);
            row++;
            // Row 3: Director label + name
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = `${directorLabel}:`;
            ws.getCell(row, 2).value = directorDisplay.toUpperCase();
            setFont(row, 1, { bold: true });
            setFont(row, 2);
            setAlign(row, 1);
            setAlign(row, 2);
            applyBorders(row, false, false);
            row++;
            // Row 4: Cédula
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'C. I. N°:';
            ws.getCell(row, 2).value = directorDoc;
            setFont(row, 1, { bold: true });
            setFont(row, 2);
            setAlign(row, 1);
            setAlign(row, 2);
            applyBorders(row, false, false);
            row++;
            // Row 5: Firma (last row of director block)
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'Firma:';
            setFont(row, 1, { bold: true });
            setAlign(row, 1);
            applyBorders(row, false, true);
            row++;
            // Row 6: blank separator (no borders)
            ws.getRow(row).height = 15;
            row++;
        }
        // ── Coordinator block ──
        if (includeCoordinator) {
            // Row 7: Elaborado por
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'Elaborado por:';
            ws.getCell(row, 2).value = 'Coordinador de Control de Estudios';
            setFont(row, 1, { bold: true });
            setFont(row, 2);
            setAlign(row, 1, 'middle', false);
            setAlign(row, 2, 'middle', false);
            applyBorders(row, true, false);
            row++;
            // Row 8: Responsable
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'Responsable: ';
            ws.getCell(row, 2).value = coordinatorDisplay.toUpperCase();
            setFont(row, 1, { bold: true });
            setFont(row, 2, { black: true });
            setAlign(row, 1, 'middle', false);
            setAlign(row, 2, 'middle', false);
            applyBorders(row, false, false);
            row++;
            // Row 9: Cédula
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'C. I. N°: ';
            ws.getCell(row, 2).value = coordinatorDoc;
            setFont(row, 1, { bold: true });
            setFont(row, 2);
            setAlign(row, 1, 'middle', false);
            setAlign(row, 2, 'middle', false);
            applyBorders(row, false, false);
            row++;
            // Row 10: Firma (last row of coordinator block)
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'Firma: ';
            setFont(row, 1, { bold: true });
            setAlign(row, 1, 'middle', false);
            applyBorders(row, false, true);
            row++;
            // Row 11: blank separator (no borders)
            ws.getRow(row).height = 15;
            row++;
        }
        // ── Funcionario block ──
        if (includeFuncionario) {
            // Row 12: Funcionario text (merged, with rich text — school year in bold)
            ws.mergeCells(row, 1, row, 2);
            ws.getRow(row).height = 39.95;
            const funcCell = ws.getCell(row, 1);
            funcCell.value = {
                richText: [
                    { text: 'Funcionario designado por el Ministerio del Poder Popular para la Educación,para la Revision de Expediente, Credenciales y firma de Título de Bachiller Año Escolar ' },
                    { font: { bold: true, size: 9, color: { argb: 'FF000000' }, name: 'Times New Roman', family: 1 }, text: schoolYearLabel },
                ],
            };
            setFont(row, 1);
            setAlign(row, 1, 'top');
            applyBorders(row, true, false, true);
            row++;
            // Row 13: Nombres y Apellidos (merged)
            ws.mergeCells(row, 1, row, 2);
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = `Nombres y Apellidos:  ${funcionarioName.toUpperCase()}`;
            setFont(row, 1, { black: true });
            ws.getCell(row, 1).alignment = { horizontal: 'justify', vertical: 'middle' };
            applyBorders(row, false, false, true);
            row++;
            // Row 14: Cédula
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'C. I. N° ';
            ws.getCell(row, 2).value = formatDocument(funcionarioDocument);
            setFont(row, 1, { bold: true });
            setFont(row, 2);
            setAlign(row, 1, 'middle', false);
            setAlign(row, 2, 'middle', false);
            applyBorders(row, false, false);
            row++;
            // Row 15: Firma (last row of funcionario block)
            ws.getRow(row).height = 15;
            ws.getCell(row, 1).value = 'Firma: ';
            setFont(row, 1, { bold: true });
            setAlign(row, 1, 'middle', false);
            applyBorders(row, false, true);
            row++;
            // Row 16: blank separator (no borders)
            ws.getRow(row).height = 15;
            row++;
        }
        // ── Declaración block ──
        if (includeDeclaracion) {
            // Row 17: Declaration text (merged, centered, no borders, size 11)
            ws.mergeCells(row, 1, row, 2);
            ws.getRow(row).height = 29.25;
            const declCell = ws.getCell(row, 1);
            declCell.value = 'ESTE DOCUMENTO ES COPIA\nFIEL Y EXACTA DEL ORIGINAL';
            declCell.font = { name: 'Times New Roman', family: 1, size: 11, color: { theme: 1 } };
            declCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            row++;
        }
        const buffer = yield wb.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="reverso-notas-certificadas.xlsx"');
        res.send(buffer);
    }
    catch (error) {
        console.error('[exportReverso] Error:', error);
        res.status(500).json({ message: error.message || 'Error al exportar el reverso' });
    }
});
exports.exportReverso = exportReverso;
