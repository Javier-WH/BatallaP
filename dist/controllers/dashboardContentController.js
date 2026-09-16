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
exports.deleteDashboardImage = exports.uploadDashboardImage = exports.updateContent = exports.getContent = void 0;
const models_1 = require("../models");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const getContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the first (and only) dashboard content record
        let content = yield models_1.DashboardContent.findOne();
        // If no content exists, create a default one
        if (!content) {
            content = yield models_1.DashboardContent.create({
                content: '',
            });
        }
        res.json({
            id: content.id,
            content: content.content,
            updatedBy: content.updatedBy,
            updatedAt: content.updatedAt,
        });
    }
    catch (error) {
        console.error('Error getting dashboard content:', error);
        res.status(500).json({ message: 'Error al obtener contenido del dashboard' });
    }
});
exports.getContent = getContent;
const updateContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { content } = req.body;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id; // Get user ID from session if available
        let dashboardContent = yield models_1.DashboardContent.findOne();
        if (!dashboardContent) {
            // Create if doesn't exist
            dashboardContent = yield models_1.DashboardContent.create({
                content,
                updatedBy: userId,
            });
        }
        else {
            // Update existing
            yield dashboardContent.update({
                content,
                updatedBy: userId,
            });
        }
        res.json({
            message: 'Contenido actualizado exitosamente',
            id: dashboardContent.id,
            content: dashboardContent.content,
        });
    }
    catch (error) {
        console.error('Error updating dashboard content:', error);
        res.status(500).json({ message: 'Error al actualizar contenido del dashboard' });
    }
});
exports.updateContent = updateContent;
const uploadDashboardImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
        }
        // Return the URL to access the image
        const imageUrl = `/uploads/dashboard-images/${req.file.filename}`;
        res.json({
            message: 'Imagen subida exitosamente',
            url: imageUrl,
            filename: req.file.filename,
        });
    }
    catch (error) {
        console.error('Error uploading dashboard image:', error);
        res.status(500).json({ message: 'Error al subir imagen' });
    }
});
exports.uploadDashboardImage = uploadDashboardImage;
const deleteDashboardImage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { filename } = req.params;
        // Construct the file path
        const uploadDir = path_1.default.join(__dirname, '../../public/uploads/dashboard-images');
        const filePath = path_1.default.join(uploadDir, filename);
        // Check if file exists
        if (fs_1.default.existsSync(filePath)) {
            // Delete the file
            fs_1.default.unlinkSync(filePath);
            res.json({ message: 'Imagen eliminada exitosamente' });
        }
        else {
            res.status(404).json({ message: 'Imagen no encontrada' });
        }
    }
    catch (error) {
        console.error('Error deleting dashboard image:', error);
        res.status(500).json({ message: 'Error al eliminar imagen' });
    }
});
exports.deleteDashboardImage = deleteDashboardImage;
