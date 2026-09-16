"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const templatesDir = path_1.default.join(__dirname, '../../templates');
if (!fs_1.default.existsSync(templatesDir)) {
    fs_1.default.mkdirSync(templatesDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, templatesDir);
    },
    filename: (_req, file, cb) => {
        // Keep the original filename (without accents/spaces)
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const base = path_1.default.basename(file.originalname, ext)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_');
        cb(null, `${base}${ext}`);
    }
});
const excelMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/octet-stream'
];
const templateUpload = (0, multer_1.default)({
    storage,
    fileFilter: (_req, file, cb) => {
        const isExcel = excelMimeTypes.includes(file.mimetype)
            || file.originalname.toLowerCase().endsWith('.xlsx')
            || file.originalname.toLowerCase().endsWith('.xls');
        if (isExcel) {
            cb(null, true);
        }
        else {
            cb(new Error('Formato de archivo no soportado. Usa un Excel (.xlsx).'));
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    }
});
exports.default = templateUpload;
