import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  confirmarImportacion,
  validarImportacion,
} from '../services/importacion-activo.service';
import {
  FilaImportacionCruda,
  LIMITE_FILAS_IMPORTACION,
} from '../models/importacion-activo.model';

const obtenerFilas = (body: unknown): FilaImportacionCruda[] => {
  const cuerpo = (body ?? {}) as Record<string, unknown>;
  const filas = cuerpo.filas;

  if (!Array.isArray(filas)) {
    throw new HttpError(400, 'El campo "filas" debe ser un arreglo', [
      { campo: 'filas', valor: null },
    ]);
  }

  if (filas.length === 0) {
    throw new HttpError(400, 'Debe enviar al menos una fila para importar', [
      { campo: 'filas', valor: 0 },
    ]);
  }

  if (filas.length > LIMITE_FILAS_IMPORTACION) {
    throw new HttpError(
      400,
      `El lote no puede superar las ${LIMITE_FILAS_IMPORTACION} filas`,
      [
        {
          campo: 'filas',
          valor: filas.length,
          maximo: LIMITE_FILAS_IMPORTACION,
        },
      ]
    );
  }

  return filas as FilaImportacionCruda[];
};

export const validarImportacionActivos = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filas = obtenerFilas(req.body);
    const data = await validarImportacion(filas);

    res.status(200).json({
      success: true,
      message: 'Validacion de importacion completada',
      errors: [],
      data,
    });
  }
);

export const confirmarImportacionActivos = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filas = obtenerFilas(req.body);
    const data = await confirmarImportacion(filas);

    res.status(200).json({
      success: true,
      message: 'Importacion de activos completada',
      errors: [],
      data,
    });
  }
);
