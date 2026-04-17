import { Request, Response } from 'express';
import { DashboardContent } from '../models';
import path from 'path';
import fs from 'fs';

export const getContent = async (req: Request, res: Response) => {
  try {
    // Get the first (and only) dashboard content record
    let content = await DashboardContent.findOne();

    // If no content exists, create a default one
    if (!content) {
      content = await DashboardContent.create({
        content: '',
      } as any);
    }

    res.json({
      id: content.id,
      content: content.content,
      updatedBy: content.updatedBy,
      updatedAt: content.updatedAt,
    });
  } catch (error) {
    console.error('Error getting dashboard content:', error);
    res.status(500).json({ message: 'Error al obtener contenido del dashboard' });
  }
};

export const updateContent = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = (req as any).user?.id; // Get user ID from session if available

    let dashboardContent = await DashboardContent.findOne();

    if (!dashboardContent) {
      // Create if doesn't exist
      dashboardContent = await DashboardContent.create({
        content,
        updatedBy: userId,
      } as any);
    } else {
      // Update existing
      await dashboardContent.update({
        content,
        updatedBy: userId,
      });
    }

    res.json({
      message: 'Contenido actualizado exitosamente',
      id: dashboardContent.id,
      content: dashboardContent.content,
    });
  } catch (error) {
    console.error('Error updating dashboard content:', error);
    res.status(500).json({ message: 'Error al actualizar contenido del dashboard' });
  }
};

export const uploadDashboardImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha enviado ninguna imagen' });
    }

    // Return the URL to access the image
    const imageUrl = `/uploads/dashboard-images/${req.file.filename}`;

    res.json({
      message: 'Imagen subida exitosamente',
      url: imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error('Error uploading dashboard image:', error);
    res.status(500).json({ message: 'Error al subir imagen' });
  }
};

export const deleteDashboardImage = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Construct the file path
    const uploadDir = path.join(__dirname, '../../public/uploads/dashboard-images');
    const filePath = path.join(uploadDir, filename);

    // Check if file exists
    if (fs.existsSync(filePath)) {
      // Delete the file
      fs.unlinkSync(filePath);
      res.json({ message: 'Imagen eliminada exitosamente' });
    } else {
      res.status(404).json({ message: 'Imagen no encontrada' });
    }
  } catch (error) {
    console.error('Error deleting dashboard image:', error);
    res.status(500).json({ message: 'Error al eliminar imagen' });
  }
};
