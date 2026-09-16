"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVenezuelaLocations = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let cachedVenezuelaData = null;
const loadVenezuelaData = () => {
    if (cachedVenezuelaData)
        return cachedVenezuelaData;
    const candidates = [
        path_1.default.resolve(process.cwd(), 'src/assets/venezuela.json'),
        path_1.default.resolve(process.cwd(), 'assets/venezuela.json'),
        path_1.default.resolve(process.cwd(), 'dist/assets/venezuela.json'),
        path_1.default.resolve(__dirname, '../assets/venezuela.json'),
        path_1.default.resolve(__dirname, '../../src/assets/venezuela.json')
    ];
    const filePath = candidates.find((p) => fs_1.default.existsSync(p)) || candidates[0];
    const raw = fs_1.default.readFileSync(filePath, 'utf-8');
    cachedVenezuelaData = JSON.parse(raw);
    return cachedVenezuelaData;
};
const getVenezuelaLocations = (_req, res) => {
    try {
        const data = loadVenezuelaData();
        res.json(data);
    }
    catch (error) {
        console.error('Error cargando datos de Venezuela:', error);
        res.status(500).json({ message: 'No se pudieron cargar los datos de ubicación' });
    }
};
exports.getVenezuelaLocations = getVenezuelaLocations;
