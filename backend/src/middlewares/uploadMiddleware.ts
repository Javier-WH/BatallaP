import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurarse de que el directorio existe
const uploadDir = path.join(__dirname, '../../public/uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar el almacenamiento
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    // Siempre guardar como 'institution_logo' con la extensión original
    const ext = path.extname(file.originalname);
    cb(null, 'institution_logo' + ext);
  }
});

// Crear el middleware de multer
const upload = multer({ 
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Aceptar solo imágenes
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // Limitar a 5MB
  }
});

export default upload;
