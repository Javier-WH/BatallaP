import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { ValidationError, UniqueConstraintError } from 'sequelize';
import sequelize from '@/config/database';
import excelUpload from '@/middlewares/excelUploadMiddleware';
import { generateTemplate, previewBulkEnrollment, processBulkEnrollment, ProcessBulkRowInput } from '@/services/bulkEnrollmentService';
import { registerAndEnrollStudent, normalizeEscolaridad } from '@/services/studentEnrollmentService';
import { Person, Matriculation } from '@/models/index';

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

export const retrySingleRow = async (req: Request, res: Response) => {
  try {
    const { payload, updateExistingName } = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, message: 'Payload es requerido' });
    }

    const doc = typeof payload.document === 'string' ? payload.document.trim() : '';

    if (doc) {
      const existingPerson = await Person.findOne({ where: { document: doc } });

      if (existingPerson) {
        const newFirst = (payload.firstName || '').trim().toLowerCase();
        const newLast = (payload.lastName || '').trim().toLowerCase();
        const existFirst = existingPerson.firstName.trim().toLowerCase();
        const existLast = existingPerson.lastName.trim().toLowerCase();
        const nameChanged = newFirst !== existFirst || newLast !== existLast;

        if (nameChanged && !updateExistingName) {
          return res.json({
            success: false,
            nameConflict: true,
            existingPerson: {
              id: existingPerson.id,
              firstName: existingPerson.firstName,
              lastName: existingPerson.lastName,
              document: existingPerson.document
            },
            message: `Ya existe "${existingPerson.firstName} ${existingPerson.lastName}" con documento ${doc}. El registro indica "${payload.firstName} ${payload.lastName}". ¿Desea actualizar el nombre?`
          });
        }

        const t = await sequelize.transaction();
        try {
          if (nameChanged && updateExistingName) {
            await existingPerson.update(
              { firstName: payload.firstName, lastName: payload.lastName },
              { transaction: t }
            );
          }

          const matriculation = await Matriculation.create(
            {
              schoolPeriodId: payload.schoolPeriodId,
              gradeId: payload.gradeId,
              sectionId: payload.sectionId || null,
              personId: existingPerson.id,
              status: 'pending',
              escolaridad: normalizeEscolaridad(payload.escolaridad)
            },
            { transaction: t }
          );

          await t.commit();
          return res.json({
            success: true,
            message: nameChanged
              ? 'Nombre actualizado e inscripción registrada'
              : 'Inscripción registrada (estudiante existente)',
            personId: existingPerson.id,
            matriculationId: matriculation.id
          });
        } catch (innerError) {
          await t.rollback();
          throw innerError;
        }
      }
    }

    const { person, matriculation } = await registerAndEnrollStudent(payload);
    res.json({
      success: true,
      message: 'Inscripción registrada',
      personId: person.id,
      matriculationId: matriculation.id
    });
  } catch (error: unknown) {
    let msg = 'Error procesando el registro';

    if (error instanceof UniqueConstraintError) {
      const fields = error.errors
        .map((e) => `${e.path ?? 'campo desconocido'}: ${e.message}`)
        .join('; ');
      msg = `Registro duplicado — ${fields}`;
    } else if (error instanceof ValidationError) {
      const details = error.errors
        .map((e) => `[${e.path ?? 'campo desconocido'}] ${e.message}`)
        .join('; ');
      msg = `Error de validación — ${details}`;
    } else if (error instanceof Error) {
      msg = error.message;
    }

    console.error('[retrySingleRow] Error:', msg);
    res.json({ success: false, message: msg });
  }
};
