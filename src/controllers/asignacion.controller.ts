import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoTexto, validarOpcion } from '../utils/validacion';
import { devolver, listarAsignaciones as obtenerListado } from '../services/activo.service';
import {
  ActivoDetalle,
  AsignacionLista,
  ParametrosListadoAsignaciones,
} from '../models/activo.model';
import { RespuestaPaginada } from '../models/comun.model';

const LIMITE_MAXIMO = 100;

export const devolverAsignacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const activo: ActivoDetalle = await devolver(Number(textoId));

    res.status(200).json({
      success: true,
      message: 'Asignacion devuelta correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const listarAsignaciones = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = comoEntero(req.query.page, 'page', 1);
    const limit = comoEntero(req.query.limit, 'limit', 10);

    if (page < 1) {
      throw new HttpError(400, 'El parametro "page" debe ser mayor o igual a 1', [
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

    const activaTexto = validarOpcion(req.query.activa, 'activa', ['true', 'false']);
    const activa = activaTexto === undefined ? undefined : activaTexto === 'true';

    const activoIdTexto = comoTexto(req.query.activoId);
    const activoId =
      activoIdTexto === '' ? undefined : comoEntero(activoIdTexto, 'activoId', 1);

    const parametros: ParametrosListadoAsignaciones = {
      page,
      limit,
      ...(activa !== undefined ? { activa } : {}),
      ...(comoTexto(req.query.usuarioId)
        ? { usuarioId: comoTexto(req.query.usuarioId) }
        : {}),
      ...(activoId !== undefined ? { activoId } : {}),
      ...(comoTexto(req.query.q) ? { q: comoTexto(req.query.q) } : {}),
    };

    const { asignaciones, meta } = await obtenerListado(parametros);

    const respuesta: RespuestaPaginada<AsignacionLista> = {
      success: true,
      message: 'Asignaciones obtenidas correctamente',
      errors: [],
      data: asignaciones,
      meta,
    };

    res.status(200).json(respuesta);
  }
);
