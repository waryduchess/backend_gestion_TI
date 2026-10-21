import { Request, Response } from 'express';
import { EntidadAdjunto } from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import {
  ENTIDADES_ADJUNTO,
  DatosCreacionAdjunto,
} from '../models/adjunto.model';
import {
  crearAdjunto,
  eliminarAdjunto,
  generarUrlDescarga,
  listarAdjuntos,
} from '../services/adjunto.service';
import { validarFirmaImagen } from '../utils/archivo';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;

const leerId = (valor: unknown): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, 'El parametro "id" debe ser un entero positivo', [
      { campo: 'id', valor: String(valor ?? '') },
    ]);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, 'El parametro "id" esta fuera de rango', [
      { campo: 'id', valor },
    ]);
  }
  return id;
};

const leerNumeroQuery = (
  valor: unknown,
  campo: string,
  predeterminado: number
): number => {
  if (valor === undefined) return predeterminado;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw new HttpError(400, `El parametro "${campo}" debe ser un entero`, [
      { campo, valor: String(valor) },
    ]);
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) {
    throw new HttpError(400, `El parametro "${campo}" esta fuera de rango`, [
      { campo, valor },
    ]);
  }
  return numero;
};

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticación requerida');
  }
  return req.usuario.id;
};

const leerEntidadTipo = (valor: unknown): EntidadAdjunto => {
  if (
    typeof valor !== 'string' ||
    !(ENTIDADES_ADJUNTO as readonly string[]).includes(valor)
  ) {
    throw new HttpError(
      400,
      'El campo "entidadTipo" debe ser ACTIVO, MANTENIMIENTO, INCIDENCIA o PROYECTO',
      [{ campo: 'entidadTipo', valor: valor ?? null }]
    );
  }
  return valor as EntidadAdjunto;
};

const leerEntidadId = (valor: unknown): string => {
  const texto =
    typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
  if (!/^[1-9]\d*$/.test(texto)) {
    throw new HttpError(400, 'El campo "entidadId" debe ser un entero positivo', [
      { campo: 'entidadId', valor: valor ?? null },
    ]);
  }
  return texto;
};

export const listarAdjuntosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = leerNumeroQuery(req.query.page, 'page', 1);
    const limit = leerNumeroQuery(req.query.limit, 'limit', 20);

    if (page < 1) {
      throw new HttpError(400, 'El parametro "page" debe ser mayor a cero', [
        { campo: 'page', valor: String(page) },
      ]);
    }
    if (limit < 1 || limit > LIMITE_MAXIMO) {
      throw new HttpError(
        400,
        `El parametro "limit" debe estar entre 1 y ${LIMITE_MAXIMO}`,
        [{ campo: 'limit', valor: String(limit) }]
      );
    }

    const resultado = await listarAdjuntos(
      {
        page,
        limit,
        entidadTipo: leerEntidadTipo(req.query.entidadTipo),
        entidadId: leerEntidadId(req.query.entidadId),
      },
      obtenerUsuarioId(req)
    );

    res.status(200).json({
      success: true,
      message: 'Adjuntos obtenidos correctamente',
      errors: [],
      data: resultado.adjuntos,
      meta: resultado.meta,
    });
  }
);

export const descargarAdjuntoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');

    const data = await generarUrlDescarga(
      leerId(req.params.id),
      obtenerUsuarioId(req)
    );

    res.status(200).json({
      success: true,
      message: 'URL de descarga generada correctamente',
      errors: [],
      data,
    });
  }
);

export const eliminarAdjuntoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await eliminarAdjunto(leerId(req.params.id), obtenerUsuarioId(req));
    res.status(204).send();
  }
);

export const crearAdjuntoController = asyncHandler(
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

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const datos: DatosCreacionAdjunto = {
      entidadTipo: leerEntidadTipo(cuerpo.entidadTipo),
      entidadId: leerEntidadId(cuerpo.entidadId),
      archivo: {
        originalname: archivo.originalname,
        mimetype: archivo.mimetype,
        size: archivo.size,
        buffer: archivo.buffer,
      },
    };

    const adjunto = await crearAdjunto(obtenerUsuarioId(req), datos);

    res.status(201).json({
      success: true,
      message: 'Imagen almacenada correctamente',
      errors: [],
      data: adjunto,
    });
  }
);
