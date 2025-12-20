import { Request, Response } from 'express';

export const uploadLogo = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
    }

    // La imagen ya se guardó con el nombre 'institution_logo' + extensión
    // No necesitamos guardar nada en la base de datos

    res.json({
      message: 'Logo subido exitosamente',
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error al subir el logo:', error);
    res.status(500).json({ message: 'Error al subir el logo' });
  }
};
