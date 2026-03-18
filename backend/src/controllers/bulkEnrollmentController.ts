import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import excelUpload from '@/middlewares/excelUploadMiddleware';
import { generateTemplate, previewBulkEnrollment, processBulkEnrollment, ProcessBulkRowInput } from '@/services/bulkEnrollmentService';

export const downloadTemplate = async (_req: Request, res: Response) => {
  try {
    const { buffer, fileName } = await generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (error) {
    console.error('[downloadTemplate] Error:', error);
    res.status(500).json({ error: 'No se pudo generar la plantilla' });
  }
};

export const previewBulk = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Debe subir un archivo Excel (.xlsx)' });
    }
    const result = await previewBulkEnrollment(req.file.path);
    res.json(result);
  } catch (error) {
    console.error('[previewBulk] Error:', error);
    res.status(500).json({ error: 'No se pudo procesar el archivo', details: (error as Error).message });
  }
};

export const processBulk = async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res.status(400).json({ error: 'Debe enviar el arreglo de filas a procesar' });
    }

    const validRows: ProcessBulkRowInput[] = rows
      .filter((row) => row.payload && !row.errors?.length)
      .map((row) => ({ rowNumber: row.rowNumber, payload: row.payload }));

    if (!validRows.length) {
      return res.status(400).json({ error: 'No hay filas válidas para procesar' });
    }

    const results = await processBulkEnrollment(validRows);
    res.json({ total: rows.length, processed: validRows.length, results });
  } catch (error) {
    console.error('[processBulk] Error:', error);
    res.status(500).json({ error: 'Error procesando la carga masiva', details: (error as Error).message });
  }
};
