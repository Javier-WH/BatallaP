import { Router } from 'express';
import { uploadLogo } from '../controllers/uploadController';
import upload from '../middlewares/uploadMiddleware';
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ruta para subir el logo de la institución
router.post('/logo', upload.single('logo'), uploadLogo);

// Ruta para obtener el logo de la institución
router.get('/logo', (req: Request, res: Response) => {
  const uploadDir = path.join(__dirname, '../../public/uploads/images');

  // Buscar archivos que empiecen con 'institution_logo'
  const files = fs.readdirSync(uploadDir).filter(file =>
    file.startsWith('institution_logo')
  );

  if (files.length === 0) {
    return res.status(404).json({ message: 'Logo no encontrado' });
  }

  // Tomar el primer archivo encontrado
  const logoFile = path.join(uploadDir, files[0]);
  res.sendFile(logoFile);
});

export default router;
