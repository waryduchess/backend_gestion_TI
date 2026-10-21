import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { validarFirmaImagen } from '../utils/archivo';
import {
  crearEvidenciaMantenimiento,
  descargarEvidenciaMantenimiento,
  eliminarEvidenciaMantenimiento,
  listarEvidenciasMantenimiento,
} from '../services/mantenimiento-evidencias.service';

const LIMITE_MAXIMO = 100;

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticación requerida');
  }
  return req.usuario.id;
};

const leerId = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(
      400,
      `El parámetro "${campo}" debe ser un entero positivo`,
      [{ campo, valor: String(valor ?? '') }]
    );
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, `El parámetro "${campo}" está fuera de rango`, [
      { campo, valor },
    ]);
  }
  return id;
};

const leerPaginacion = (req: Request): { page: number; limit: number } => {
  const leerEntero = (
    valor: unknown,
    campo: string,
    predeterminado: number
  ): number => {
    if (valor === undefined) return predeterminado;
    if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
      throw new HttpError(400, `El parámetro "${campo}" debe ser un entero`, [
        { campo, valor: String(valor) },
      ]);
    }
    return Number(valor);
  };

  const page = leerEntero(req.query.page, 'page', 1);
  const limit = leerEntero(req.query.limit, 'limit', 20);
  if (page < 1) {
    throw new HttpError(400, 'El parámetro "page" debe ser mayor a cero', [
      { campo: 'page', valor: String(page) },
    ]);
  }
  if (limit < 1 || limit > LIMITE_MAXIMO) {
    throw new HttpError(
      400,
      `El parámetro "limit" debe estar entre 1 y ${LIMITE_MAXIMO}`,
      [{ campo: 'limit', valor: String(limit) }]
    );
  }
  return { page, limit };
};

export const listarEvidenciasMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { page, limit } = leerPaginacion(req);
    const resultado = await listarEvidenciasMantenimiento(
      leerId(req.params.id, 'id'),
      obtenerUsuarioId(req),
      page,
      limit
    );

    res.status(200).json({
      success: true,
      message: 'Evidencias del mantenimiento obtenidas correctamente',
      errors: [],
      data: resultado.adjuntos,
      meta: resultado.meta,
    });
  }
);

export const crearEvidenciaMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const archivo = req.file;
    if (!archivo) {
      throw new HttpError(400, 'El campo "archivo" es obligatorio', [
        { campo: 'archivo', valor: null },
      ]);
    }
    if (!validarFirmaImagen(archivo.mimetype, archivo.buffer)) {
      throw new HttpError(
        400,
        'El contenido del archivo no corresponde a una imagen válida',
        [{ campo: 'archivo', valor: archivo.mimetype }]
      );
    }

    const evidencia = await crearEvidenciaMantenimiento(
      leerId(req.params.id, 'id'),
      obtenerUsuarioId(req),
      {
        originalname: archivo.originalname,
        mimetype: archivo.mimetype,
        size: archivo.size,
        buffer: archivo.buffer,
      }
    );

    res.status(201).json({
      success: true,
      message: 'Evidencia almacenada correctamente',
      errors: [],
      data: evidencia,
    });
  }
);

export const descargarEvidenciaMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    res.status(200).json({
      success: true,
      message: 'URL de descarga de la evidencia generada correctamente',
      errors: [],
      data: await descargarEvidenciaMantenimiento(
        leerId(req.params.id, 'id'),
        leerId(req.params.adjuntoId, 'adjuntoId'),
        obtenerUsuarioId(req)
      ),
    });
  }
);

export const eliminarEvidenciaMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await eliminarEvidenciaMantenimiento(
      leerId(req.params.id, 'id'),
      leerId(req.params.adjuntoId, 'adjuntoId'),
      obtenerUsuarioId(req)
    );
    res.status(204).send();
  }
);
