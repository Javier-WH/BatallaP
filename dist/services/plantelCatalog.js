"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllPlanteles = exports.findPlantelByCode = exports.searchPlanteles = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedPlanteles = null;
const loadPlanteles = () => {
    // Always reload from file to get fresh data after scraping
    const candidates = [
        path_1.default.resolve(process.cwd(), 'src/assets/planteles.json'),
        path_1.default.resolve(process.cwd(), 'assets/planteles.json'),
        path_1.default.resolve(process.cwd(), 'dist/assets/planteles.json'),
        path_1.default.resolve(__dirname, '../assets/planteles.json'),
        path_1.default.resolve(__dirname, '../../src/assets/planteles.json')
    ];
    const filePath = candidates.find((p) => fs_1.default.existsSync(p)) || candidates[0];
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    cachedPlanteles = JSON.parse(raw);
    return cachedPlanteles;
};
const normalize = (value) => value ? value.trim().toLowerCase() : null;
const searchPlanteles = (params) => {
    const { q, state, municipality, limit } = params;
    const target = loadPlanteles();
    const normalizedQuery = normalize(q !== null && q !== void 0 ? q : undefined);
    const normalizedState = normalize(state !== null && state !== void 0 ? state : undefined);
    const normalizedMunicipality = normalize(municipality !== null && municipality !== void 0 ? municipality : undefined);
    const limitNumber = typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(limit, 200)
        : undefined; // No limit when not specified
    const filtered = target.filter((plantel) => {
        if (normalizedState && normalize(plantel.state) !== normalizedState) {
            return false;
        }
        if (normalizedMunicipality &&
            normalize(plantel.municipality) !== normalizedMunicipality) {
            return false;
        }
        if (normalizedQuery) {
            const combined = [
                plantel.name,
                plantel.deaCode,
                plantel.state,
                plantel.municipality,
                plantel.parish,
                plantel.dependency
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return combined.includes(normalizedQuery);
        }
        return true;
    });
    return filtered.slice(0, limitNumber);
};
exports.searchPlanteles = searchPlanteles;
const findPlantelByCode = (code) => {
    const normalizedCode = normalize(code);
    if (!normalizedCode)
        return undefined;
    return loadPlanteles().find((plantel) => normalize(plantel.deaCode) === normalizedCode ||
        normalize(plantel.name) === normalizedCode);
};
exports.findPlantelByCode = findPlantelByCode;
const getAllPlanteles = () => loadPlanteles();
exports.getAllPlanteles = getAllPlanteles;
