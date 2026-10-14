import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  confirmarImportacionSecretos,
  validarImportacionSecretos,
} from '../services/importacion-secreto.service';
import {
  FilaImportacionSecretoCruda,
  LIMITE_FILAS_IMPORTACION_SECRETOS,
} from '../models/importacion-secreto.model';
import { asyncHandler } from '../utils/asyncHandler';

const obtenerFilas = (body: unknown): FilaImportacionSecretoCruda[] => {
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

  if (filas.length > LIMITE_FILAS_IMPORTACION_SECRETOS) {
    throw new HttpError(
      400,
      `El lote no puede superar las ${LIMITE_FILAS_IMPORTACION_SECRETOS} filas`,
      [
        {
          campo: 'filas',
          valor: filas.length,
          maximo: LIMITE_FILAS_IMPORTACION_SECRETOS,
        },
      ]
    );
  }

  return filas as FilaImportacionSecretoCruda[];
};

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

export const validarImportacionSecretosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filas = obtenerFilas(req.body);
    const data = await validarImportacionSecretos(filas);

    res.status(200).json({
      success: true,
      message: 'Validacion de importacion de secretos completada',
      errors: [],
      data,
    });
  }
);

export const confirmarImportacionSecretosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const filas = obtenerFilas(req.body);
    const data = await confirmarImportacionSecretos(obtenerUsuarioId(req), filas);

    res.status(200).json({
      success: true,
      message: 'Importacion de secretos completada',
      errors: [],
      data,
    });
  }
);
