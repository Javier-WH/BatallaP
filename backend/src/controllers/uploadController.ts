import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export const getPlanningLogo = async (_req: Request, res: Response) => {
  const logoPath = path.resolve(process.cwd(), 'public', 'uploads', 'images', 'MinisterioViejo.png');
  if (!fs.existsSync(logoPath)) {
    return res.status(404).json({ message: 'Logo de planificación no encontrado' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.sendFile(logoPath);
};

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

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Lists the images available under public/uploads/images so the UI can offer
 * them (e.g. as a title background). URLs are relative on purpose so they keep
 * working behind any host/port in deploy.
 */
export const listImages = async (_req: Request, res: Response) => {
  try {
    const uploadDir = path.join(__dirname, '../../public/uploads/images');
    if (!fs.existsSync(uploadDir)) return res.json([]);

    const images = fs.readdirSync(uploadDir)
      .filter(f => IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map(f => ({ name: f, url: `/uploads/images/${f}` }));

    return res.json(images);
  } catch (error) {
    console.error('[listImages] Error:', error);
    return res.status(500).json({ message: 'Error al listar imágenes' });
  }
};

export const uploadTitleBackground = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
    }
    return res.json({
      message: 'Imagen subida exitosamente',
      name: req.file.filename,
      url: `/uploads/images/${req.file.filename}`,
    });
  } catch (error) {
    console.error('[uploadTitleBackground] Error:', error);
    return res.status(500).json({ message: 'Error al subir la imagen' });
  }
};
