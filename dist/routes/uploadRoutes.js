"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadController_1 = require("../controllers/uploadController");
const uploadMiddleware_1 = __importDefault(require("../middlewares/uploadMiddleware"));
const titleBackgroundUploadMiddleware_1 = __importDefault(require("../middlewares/titleBackgroundUploadMiddleware"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Ruta para subir el logo de la institución
router.post('/logo', uploadMiddleware_1.default.single('logo'), uploadController_1.uploadLogo);
router.get('/planning-logo', uploadController_1.getPlanningLogo);
// Imágenes disponibles + subida de fondos para títulos
router.get('/images', uploadController_1.listImages);
router.post('/title-background', titleBackgroundUploadMiddleware_1.default.single('image'), uploadController_1.uploadTitleBackground);
// Ruta para obtener el logo de la institución
router.get('/logo', (req, res) => {
    const uploadDir = path_1.default.join(__dirname, '../../public/uploads/images');
    const files = fs_1.default.readdirSync(uploadDir).filter(file => file.startsWith('institution_logo'));
    if (files.length === 0) {
        return res.status(404).json({ message: 'Logo no encontrado' });
    }
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const logoFile = path_1.default.join(uploadDir, files[0]);
    res.sendFile(logoFile);
});
// Ruta para subir documentos
const documentUploadMiddleware_1 = __importDefault(require("../middlewares/documentUploadMiddleware"));
const uploadController_2 = require("../controllers/uploadController");
router.post('/documents', documentUploadMiddleware_1.default.single('file'), uploadController_2.uploadDocument);
exports.default = router;
