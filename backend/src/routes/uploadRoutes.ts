import { Router } from 'express';
import { getPlanningLogo, uploadLogo } from '../controllers/uploadController';
import upload from '../middlewares/uploadMiddleware';
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ruta para subir el logo de la institución
router.post('/logo', upload.single('logo'), uploadLogo);
router.get('/planning-logo', getPlanningLogo);

// Ruta para obtener el logo de la institución
router.get('/logo', (req: Request, res: Response) => {
  const uploadDir = path.join(__dirname, '../../public/uploads/images');

  const files = fs.readdirSync(uploadDir).filter(file =>
    file.startsWith('institution_logo')
  );

  if (files.length === 0) {
    return res.status(404).json({ message: 'Logo no encontrado' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  const logoFile = path.join(uploadDir, files[0]);
  res.sendFile(logoFile);
});

// Ruta para subir documentos
import uploadDocument from '../middlewares/documentUploadMiddleware';
import { uploadDocument as uploadDocumentController } from '../controllers/uploadController';
router.post('/documents', uploadDocument.single('file'), uploadDocumentController);

export default router;
