import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const uploadLogo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
    }

    // Clean up old logo files with different extensions
    const uploadDir = path.join(__dirname, '../../public/uploads/images');
    try {
      const oldFiles = fs.readdirSync(uploadDir).filter(f => f.startsWith('institution_logo'));
      oldFiles.forEach(f => {
        if (f !== req.file!.filename) {
          fs.unlinkSync(path.join(uploadDir, f));
        }
      });
    } catch { /* safe to ignore */ }

    res.json({
      message: 'Logo subido exitosamente',
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error al subir el logo:', error);
    res.status(500).json({ message: 'Error al subir el logo' });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ message: 'Error al subir documento' });
  }
};
