import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../tmp/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const excelMimeTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel'
];

const excelUpload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (excelMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Usa un Excel (.xlsx).'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

export default excelUpload;
