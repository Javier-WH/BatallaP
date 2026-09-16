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
exports.getSubjectOrderMap = getSubjectOrderMap;
exports.getSubjectIncludeInAverageMap = getSubjectIncludeInAverageMap;
exports.getSubjectOrderMapByGradeAndPeriod = getSubjectOrderMapByGradeAndPeriod;
exports.getSubjectNotRepairableMap = getSubjectNotRepairableMap;
exports.getSubjectIncludeInAverageMapByGradeAndPeriod = getSubjectIncludeInAverageMapByGradeAndPeriod;
exports.getSubjectNotRepairableMapByGradeAndPeriod = getSubjectNotRepairableMapByGradeAndPeriod;
exports.sortSubjectsByOrder = sortSubjectsByOrder;
exports.sortSubjectsWithPendingAtEnd = sortSubjectsWithPendingAtEnd;
const PeriodGrade_1 = __importDefault(require("../models/PeriodGrade.js"));
const PeriodGradeSubject_1 = __importDefault(require("../models/PeriodGradeSubject.js"));
/**
 * Devuelve un Map<subjectId, order> para un PeriodGrade.
 * Si no existe, devuelve un Map vacío (callers aplicarán fallback alfabético).
 */
function getSubjectOrderMap(periodGradeId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = new Map();
        if (!periodGradeId)
            return map;
        const rows = yield PeriodGradeSubject_1.default.findAll({
            where: { periodGradeId },
            attributes: ['subjectId', 'order'],
            transaction,
        });
        rows.forEach((pgs) => {
            if (pgs.order !== null && pgs.order !== undefined) {
                map.set(pgs.subjectId, pgs.order);
            }
        });
        return map;
    });
}
/**
 * Devuelve un Map<subjectId, includeInAverage> para un PeriodGrade.
 * Materias no presentes en el mapa se asumen como includeInAverage = true.
 */
function getSubjectIncludeInAverageMap(periodGradeId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = new Map();
        if (!periodGradeId)
            return map;
        const rows = yield PeriodGradeSubject_1.default.findAll({
            where: { periodGradeId },
            attributes: ['subjectId', 'includeInAverage'],
            transaction,
        });
        rows.forEach((pgs) => {
            map.set(pgs.subjectId, pgs.includeInAverage);
        });
        return map;
    });
}
/**
 * Resuelve el PeriodGrade a partir de gradeId + schoolPeriodId y devuelve
 * el mapa de orden de sus materias.
 */
function getSubjectOrderMapByGradeAndPeriod(gradeId, schoolPeriodId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!gradeId || !schoolPeriodId)
            return new Map();
        const pg = yield PeriodGrade_1.default.findOne({
            where: { gradeId, schoolPeriodId },
            attributes: ['id'],
            transaction,
        });
        if (!pg)
            return new Map();
        return getSubjectOrderMap(pg.id, transaction);
    });
}
/**
 * Devuelve un Map<subjectId, notRepairable> para un PeriodGrade.
 * Materias no presentes en el mapa se asumen como notRepairable = false.
 */
function getSubjectNotRepairableMap(periodGradeId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        const map = new Map();
        if (!periodGradeId)
            return map;
        const rows = yield PeriodGradeSubject_1.default.findAll({
            where: { periodGradeId },
            attributes: ['subjectId', 'notRepairable'],
            transaction,
        });
        rows.forEach((pgs) => {
            map.set(pgs.subjectId, pgs.notRepairable);
        });
        return map;
    });
}
/**
 * Resuelve el PeriodGrade a partir de gradeId + schoolPeriodId y devuelve
 * el mapa de includeInAverage de sus materias.
 */
function getSubjectIncludeInAverageMapByGradeAndPeriod(gradeId, schoolPeriodId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!gradeId || !schoolPeriodId)
            return new Map();
        const pg = yield PeriodGrade_1.default.findOne({
            where: { gradeId, schoolPeriodId },
            attributes: ['id'],
            transaction,
        });
        if (!pg)
            return new Map();
        return getSubjectIncludeInAverageMap(pg.id, transaction);
    });
}
/**
 * Resuelve el PeriodGrade a partir de gradeId + schoolPeriodId y devuelve
 * el mapa de notRepairable de sus materias.
 */
function getSubjectNotRepairableMapByGradeAndPeriod(gradeId, schoolPeriodId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!gradeId || !schoolPeriodId)
            return new Map();
        const pg = yield PeriodGrade_1.default.findOne({
            where: { gradeId, schoolPeriodId },
            attributes: ['id'],
            transaction,
        });
        if (!pg)
            return new Map();
        return getSubjectNotRepairableMap(pg.id, transaction);
    });
}
/**
 * Ordena in-place / devuelve una nueva lista ordenada según el orderMap,
 * con fallback alfabético por nombre de materia.
 *
 * @param items  Elementos que contienen un subjectId y opcionalmente un nombre
 * @param getSubjectId  Selector que devuelve el subjectId de cada item
 * @param getSubjectName  Selector opcional para fallback alfabético
 * @param orderMap  Mapa proveniente de getSubjectOrderMap(...)
 */
function sortSubjectsByOrder(items, getSubjectId, getSubjectName, orderMap) {
    const FALLBACK = Number.MAX_SAFE_INTEGER;
    return [...items].sort((a, b) => {
        var _a, _b;
        const idA = getSubjectId(a);
        const idB = getSubjectId(b);
        const orderA = (idA != null && orderMap.get(idA) != null) ? orderMap.get(idA) : FALLBACK;
        const orderB = (idB != null && orderMap.get(idB) != null) ? orderMap.get(idB) : FALLBACK;
        if (orderA !== orderB)
            return orderA - orderB;
        // Fallback alfabético cuando ambos carecen de orden o empatan
        if (getSubjectName) {
            const nameA = ((_a = getSubjectName(a)) !== null && _a !== void 0 ? _a : '').toString();
            const nameB = ((_b = getSubjectName(b)) !== null && _b !== void 0 ? _b : '').toString();
            return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
        }
        return 0;
    });
}
/**
 * Utilidad: separa items en [regulares, pendientes] y retorna una lista donde
 * las pendientes van al final (ordenadas internamente por nombre).
 * Los regulares conservan el orden canónico del orderMap.
 */
function sortSubjectsWithPendingAtEnd(items, getSubjectId, getSubjectName, isPending, orderMap) {
    const regular = [];
    const pending = [];
    items.forEach((it) => (isPending(it) ? pending.push(it) : regular.push(it)));
    const sortedRegular = sortSubjectsByOrder(regular, getSubjectId, getSubjectName, orderMap);
    const sortedPending = getSubjectName
        ? [...pending].sort((a, b) => {
            var _a, _b;
            return ((_a = getSubjectName(a)) !== null && _a !== void 0 ? _a : '').toString().localeCompare(((_b = getSubjectName(b)) !== null && _b !== void 0 ? _b : '').toString(), 'es', { sensitivity: 'base' });
        })
        : pending;
    return [...sortedRegular, ...sortedPending];
}
