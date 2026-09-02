import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../public/uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Title backgrounds are kept side by side (prefixed) so the user can switch
// between them from the title layout editor.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `title_bg_${Date.now()}_${base}${ext}`);
  },
});

const uploadTitleBackground = multer({
  storage,
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export default uploadTitleBackground;
