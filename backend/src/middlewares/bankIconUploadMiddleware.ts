import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Bank icon uploads land next to the bundled catalog icons.
const uploadDir = path.join(__dirname, '../../public/uploads/banks');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `custom-${uuidv4()}${ext}`);
  }
});

const bankIconUpload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB is plenty for a small icon
  }
});

export default bankIconUpload;
