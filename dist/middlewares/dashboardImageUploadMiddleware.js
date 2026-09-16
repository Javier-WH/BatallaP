"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
// Asegurarse de que el directorio existe
const uploadDir = path_1.default.join(__dirname, '../../public/uploads/dashboard-images');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configurar el almacenamiento
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Generar nombre único usando UUID
        const ext = path_1.default.extname(file.originalname);
        const uniqueName = (0, uuid_1.v4)() + ext;
        cb(null, uniqueName);
    }
});
// Crear el middleware de multer
const upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Aceptar solo imágenes
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // Limitar a 5MB
    }
});
exports.default = upload;
