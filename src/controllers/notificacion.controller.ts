import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, validarOpcion } from '../utils/validacion';
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from '../services/notificacion.service';
import { ParametrosListadoNotificaciones } from '../models/notificacion.model';

const LIMITE_MAXIMO = 100;

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

const obtenerIdNotificacion = (valor: unknown): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(
      400,
      'El parametro "id" debe ser un numero entero positivo',
      [{ campo: 'id', valor: typeof valor === 'string' ? valor : undefined }]
    );
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, 'El parametro "id" esta fuera de rango', [
      { campo: 'id', valor },
    ]);
  }
  return id;
};

export const listarNotificacionesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = comoEntero(req.query.page, 'page', 1);
    const limit = comoEntero(req.query.limit, 'limit', 20);
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new HttpError(400, 'El parametro "page" debe ser mayor o igual a 1', [
        { campo: 'page', valor: String(page) },
      ]);
    }
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMITE_MAXIMO) {
      throw new HttpError(
        400,
        `El parametro "limit" debe estar entre 1 y ${LIMITE_MAXIMO}`,
        [{ campo: 'limit', valor: String(limit) }]
      );
    }

    const leidaTexto = validarOpcion(
      req.query.leida,
      'leida',
      ['true', 'false']
    );
    const parametros: ParametrosListadoNotificaciones = {
      usuarioId: obtenerUsuarioId(req),
      page,
      limit,
      ...(leidaTexto !== undefined ? { leida: leidaTexto === 'true' } : {}),
    };
    const resultado = await listarNotificaciones(parametros);

    res.status(200).json({
      success: true,
      message: 'Notificaciones obtenidas correctamente',
      errors: [],
      data: resultado.notificaciones,
      meta: resultado.meta,
    });
  }
);

export const marcarNotificacionLeidaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const usuarioId = obtenerUsuarioId(req);
    const id = obtenerIdNotificacion(req.params.id);
    const notificacion = await marcarNotificacionLeida(usuarioId, id);

    res.status(200).json({
      success: true,
      message: 'Notificacion marcada como leida',
      errors: [],
      data: notificacion,
    });
  }
);

export const marcarTodasLeidasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const usuarioId = obtenerUsuarioId(req);
    const total = await marcarTodasLeidas(usuarioId);

    res.status(200).json({
      success: true,
      message: 'Notificaciones marcadas como leidas',
      errors: [],
      data: { marcadasComoLeidas: total },
    });
  }
);
