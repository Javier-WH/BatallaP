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
exports.uploadTitleBackground = exports.listImages = exports.uploadDocument = exports.uploadLogo = exports.getPlanningLogo = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const getPlanningLogo = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const logoPath = path_1.default.resolve(process.cwd(), 'public', 'uploads', 'images', 'MinisterioViejo.png');
    if (!fs_1.default.existsSync(logoPath)) {
        return res.status(404).json({ message: 'Logo de planificación no encontrado' });
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.sendFile(logoPath);
});
exports.getPlanningLogo = getPlanningLogo;
const uploadLogo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
        }
        // Clean up old logo files with different extensions
        const uploadDir = path_1.default.join(__dirname, '../../public/uploads/images');
        try {
            const oldFiles = fs_1.default.readdirSync(uploadDir).filter(f => f.startsWith('institution_logo'));
            oldFiles.forEach(f => {
                if (f !== req.file.filename) {
                    fs_1.default.unlinkSync(path_1.default.join(uploadDir, f));
                }
            });
        }
        catch ( /* safe to ignore */_a) { /* safe to ignore */ }
        res.json({
            message: 'Logo subido exitosamente',
            filename: req.file.filename
        });
    }
    catch (error) {
        console.error('Error al subir el logo:', error);
        res.status(500).json({ message: 'Error al subir el logo' });
    }
});
exports.uploadLogo = uploadLogo;
const uploadDocument = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha enviado ningún archivo' });
        }
        const fileUrl = `/uploads/documents/${req.file.filename}`;
        res.json({
            message: 'Documento subido exitosamente',
            path: fileUrl,
            filename: req.file.filename
        });
    }
    catch (error) {
        console.error('Error al subir documento:', error);
        res.status(500).json({ message: 'Error al subir documento' });
    }
});
exports.uploadDocument = uploadDocument;
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
/**
 * Lists the images available under public/uploads/images so the UI can offer
 * them (e.g. as a title background). URLs are relative on purpose so they keep
 * working behind any host/port in deploy.
 */
const listImages = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const uploadDir = path_1.default.join(__dirname, '../../public/uploads/images');
        if (!fs_1.default.existsSync(uploadDir))
            return res.json([]);
        const images = fs_1.default.readdirSync(uploadDir)
            .filter(f => IMAGE_EXTENSIONS.includes(path_1.default.extname(f).toLowerCase()))
            .sort((a, b) => a.localeCompare(b))
            .map(f => ({ name: f, url: `/uploads/images/${f}` }));
        return res.json(images);
    }
    catch (error) {
        console.error('[listImages] Error:', error);
        return res.status(500).json({ message: 'Error al listar imágenes' });
    }
});
exports.listImages = listImages;
const uploadTitleBackground = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
        }
        return res.json({
            message: 'Imagen subida exitosamente',
            name: req.file.filename,
            url: `/uploads/images/${req.file.filename}`,
        });
    }
    catch (error) {
        console.error('[uploadTitleBackground] Error:', error);
        return res.status(500).json({ message: 'Error al subir la imagen' });
    }
});
exports.uploadTitleBackground = uploadTitleBackground;
