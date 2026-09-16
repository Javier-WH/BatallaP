"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(__dirname, '../../public/uploads/images');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Title backgrounds are kept side by side (prefixed) so the user can switch
// between them from the title layout editor.
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname) || '.jpg';
        const base = path_1.default.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 40);
        cb(null, `title_bg_${Date.now()}_${base}${ext}`);
    },
});
const uploadTitleBackground = (0, multer_1.default)({
    storage,
    fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
    limits: { fileSize: 10 * 1024 * 1024 },
});
exports.default = uploadTitleBackground;
