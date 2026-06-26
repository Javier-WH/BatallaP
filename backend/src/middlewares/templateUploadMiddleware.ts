import multer from 'multer';
import path from 'path';
import fs from 'fs';

const templatesDir = path.join(__dirname, '../../templates');
if (!fs.existsSync(templatesDir)) {
  fs.mkdirSync(templatesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, templatesDir);
  },
  filename: (_req, file, cb) => {
    // Keep the original filename (without accents/spaces)
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext)
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

const templateUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const isExcel = excelMimeTypes.includes(file.mimetype)
      || file.originalname.toLowerCase().endsWith('.xlsx')
      || file.originalname.toLowerCase().endsWith('.xls');
    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Usa un Excel (.xlsx).'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

export default templateUpload;