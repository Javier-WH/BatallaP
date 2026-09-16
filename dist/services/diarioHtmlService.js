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
exports.generateDiariosHtml = generateDiariosHtml;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const models_1 = require("../models/index.js");
// ── Build time slots from settings (same logic as diarioService) ──
function buildSlotsFromSettings(settings) {
    const use12h = settings.time_format === '12';
    const manana = [];
    const tarde = [];
    const fmt = (h, m) => {
        if (use12h) {
            const h12 = h % 12 || 12;
            const ampm = h < 12 ? 'AM' : 'PM';
            return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
        }
        return `${h}:${m.toString().padStart(2, '0')}`;
    };
    // Morning
    const mStart = settings.morning_start_time || '07:00';
    let [mh, mm] = mStart.split(':').map(Number);
    const mBlocksBefore = Number(settings.morning_blocks_before_recess) || 3;
    const mMinBefore = Number(settings.morning_block_minutes_before) || 45;
    const mRecess = Number(settings.morning_recess_minutes) || 0;
    const mBlocksAfter = Number(settings.morning_blocks_after_recess) || 0;
    const mMinAfter = Number(settings.morning_block_minutes_after) || 40;
    let mIdx = 1;
    for (let i = 0; i < mBlocksBefore; i++) {
        const start = fmt(mh, mm);
        mm += mMinBefore;
        while (mm >= 60) {
            mm -= 60;
            mh++;
        }
        manana.push({ id: `m${mIdx}`, start, end: fmt(mh, mm) });
        mIdx++;
    }
    if (mRecess > 0) {
        mm += mRecess;
        while (mm >= 60) {
            mm -= 60;
            mh++;
        }
    }
    for (let i = 0; i < mBlocksAfter; i++) {
        const start = fmt(mh, mm);
        mm += mMinAfter;
        while (mm >= 60) {
            mm -= 60;
            mh++;
        }
        manana.push({ id: `m${mIdx}`, start, end: fmt(mh, mm) });
        mIdx++;
    }
    // Afternoon
    const aStart = settings.afternoon_start_time || '13:00';
    let [ah, am] = aStart.split(':').map(Number);
    const aBlocksBefore = Number(settings.afternoon_blocks_before_recess) || 2;
    const aMinBefore = Number(settings.afternoon_block_minutes_before) || 45;
    const aRecess = Number(settings.afternoon_recess_minutes) || 0;
    const aBlocksAfter = Number(settings.afternoon_blocks_after_recess) || 0;
    const aMinAfter = Number(settings.afternoon_block_minutes_after) || 40;
    let aIdx = 1;
    for (let i = 0; i < aBlocksBefore; i++) {
        const start = fmt(ah, am);
        am += aMinBefore;
        while (am >= 60) {
            am -= 60;
            ah++;
        }
        tarde.push({ id: `t${aIdx}`, start, end: fmt(ah, am) });
        aIdx++;
    }
    if (aRecess > 0) {
        am += aRecess;
        while (am >= 60) {
            am -= 60;
            ah++;
        }
    }
    for (let i = 0; i < aBlocksAfter; i++) {
        const start = fmt(ah, am);
        am += aMinAfter;
        while (am >= 60) {
            am -= 60;
            ah++;
        }
        tarde.push({ id: `t${aIdx}`, start, end: fmt(ah, am) });
        aIdx++;
    }
    return { manana, tarde };
}
function formatGradeName(name) {
    const match = name.match(/^(\d+)/);
    if (match) {
        return `${match[1]}° AÑO`;
    }
    return name.toUpperCase();
}
// Spanish title case: capitalize nouns/adjectives, lowercase articles/prepositions/conjunctions
const LOWER_WORDS = new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
    'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin',
    'sobre', 'entre', 'hasta', 'desde', 'hacia', 'según',
    'y', 'o', 'e', 'u', 'ni', 'pero', 'sino', 'que',
]);
function titleCaseSpanish(text) {
    return text
        .trim()
        .split(/\s+/)
        .map((word, i) => {
        const lower = word.toLowerCase();
        // Always capitalize first word; lowercase articles/prepositions/conjunctions otherwise
        if (i > 0 && LOWER_WORDS.has(lower)) {
            return lower;
        }
        return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
        .join(' ');
}
// ── Fetch section info + schedule entries for selected sections ──
function fetchSectionData(schoolPeriodId, sectionIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const schedules = yield models_1.Schedule.findAll({
            where: {
                schoolPeriodId,
                periodGradeSectionId: sectionIds,
            },
            include: [
                {
                    model: models_1.PeriodGradeSection,
                    as: 'section',
                    include: [
                        {
                            model: models_1.PeriodGrade,
                            as: 'periodGrade',
                            include: [{ model: models_1.Grade, as: 'grade' }],
                        },
                        { model: models_1.Section, as: 'section' },
                    ],
                },
                {
                    model: models_1.ScheduleEntry,
                    as: 'entries',
                    include: [
                        { model: models_1.Subject, as: 'subject' },
                        { model: models_1.Person, as: 'teacher' },
                    ],
                },
            ],
        });
        const result = schedules.map((s) => {
            var _a, _b, _c, _d, _e, _f, _g;
            const grade = (_b = (_a = s.section) === null || _a === void 0 ? void 0 : _a.periodGrade) === null || _b === void 0 ? void 0 : _b.grade;
            const section = (_c = s.section) === null || _c === void 0 ? void 0 : _c.section;
            const entries = {};
            for (const e of s.entries || []) {
                const dayUpper = (e.day || '').toUpperCase();
                const key = `${dayUpper}|${e.periodId}`;
                // If multiple entries for same slot, join with " / "
                const subjName = titleCaseSpanish((_e = (_d = e.subject) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : '');
                if (entries[key]) {
                    entries[key] = entries[key] + ' / ' + subjName;
                }
                else {
                    entries[key] = subjName;
                }
            }
            return {
                level: grade ? formatGradeName(grade.name) : '',
                section: (_f = section === null || section === void 0 ? void 0 : section.name) !== null && _f !== void 0 ? _f : '',
                gradeOrder: (_g = grade === null || grade === void 0 ? void 0 : grade.order) !== null && _g !== void 0 ? _g : 99,
                entries,
            };
        });
        result.sort((a, b) => {
            if (a.gradeOrder !== b.gradeOrder)
                return a.gradeOrder - b.gradeOrder;
            return (a.section || '').localeCompare(b.section || '', 'es');
        });
        return result;
    });
}
// ── Compute week dates (Monday–Friday) from a given date string (YYYY-MM-DD) ──
function computeWeekDates(weekDate) {
    if (!weekDate)
        return null;
    const date = new Date(weekDate + 'T00:00:00');
    if (isNaN(date.getTime()))
        return null;
    // Find Monday of that week (0=Sun, 1=Mon, ...)
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const days = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES'];
    const result = {};
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dd = d.getDate().toString().padStart(2, '0');
        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
        const yyyy = d.getFullYear();
        result[days[i]] = `${dd}/${mm}/${yyyy}`;
    }
    return result;
}
// ── Main: generate HTML with populated data ──
function generateDiariosHtml(schoolPeriodId, sectionIds, settings, weekDate) {
    return __awaiter(this, void 0, void 0, function* () {
        const classes = yield fetchSectionData(schoolPeriodId, sectionIds);
        if (classes.length === 0) {
            throw new Error('No se encontraron secciones para los filtros seleccionados');
        }
        const slots = buildSlotsFromSettings(settings);
        // Slots with period IDs for lookups: [{ id, label }, ...]
        const morningSlots = slots.manana.map(s => ({ id: s.id, label: `${s.start} - ${s.end}` }));
        const afternoonSlots = slots.tarde.map(s => ({ id: s.id, label: `${s.start} - ${s.end}` }));
        const weekDates = computeWeekDates(weekDate);
        // Read template
        const templatePath = path_1.default.join(__dirname, '..', '..', 'templates', 'diario_template.html');
        let html = fs_1.default.readFileSync(templatePath, 'utf-8');
        // Replace placeholders with real data
        const classesJson = JSON.stringify(classes);
        const morningJson = JSON.stringify(morningSlots);
        const afternoonJson = JSON.stringify(afternoonSlots);
        const weekDatesJson = JSON.stringify(weekDates);
        html = html.replace('/*__CLASSES__*/[]', classesJson);
        html = html.replace('/*__MORNING_SLOTS__*/[]', morningJson);
        html = html.replace('/*__AFTERNOON_SLOTS__*/[]', afternoonJson);
        html = html.replace('/*__WEEK_DATES__*/null', weekDatesJson);
        return html;
    });
}
