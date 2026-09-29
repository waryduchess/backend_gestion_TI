import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoTexto, validarCampoOpcion, validarOpcion } from '../utils/validacion';
import {
  ESTADOS_DE_ACTIVO,
  crear,
  listar,
  obtenerPorId,
} from '../services/activo.service';
import {
  ActivoDetalle,
  ActivoResumen,
  DatosCreacionActivo,
  ParametrosListadoActivos,
} from '../models/activo.model';
import { RespuestaPaginada } from '../models/comun.model';

const LIMITE_MAXIMO = 100;

export const listarActivos = asyncHandler(
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

    const estado = validarOpcion(req.query.estado, 'estado', ESTADOS_DE_ACTIVO);

    const parametros: ParametrosListadoActivos = {
      page,
      limit,
      ...(estado ? { estado: estado as (typeof ESTADOS_DE_ACTIVO)[number] } : {}),
      ...(comoTexto(req.query.tipo) ? { tipo: comoTexto(req.query.tipo) } : {}),
      ...(comoTexto(req.query.sucursal)
        ? { sucursal: comoTexto(req.query.sucursal) }
        : {}),
      ...(comoTexto(req.query.responsableId)
        ? { responsableId: comoTexto(req.query.responsableId) }
        : {}),
      ...(comoTexto(req.query.q) ? { q: comoTexto(req.query.q) } : {}),
    };

    const { activos, meta } = await listar(parametros);

    const respuesta: RespuestaPaginada<ActivoResumen> = {
      success: true,
      message: 'Activos obtenidos correctamente',
      errors: [],
      data: activos,
      meta,
    };

    res.status(200).json(respuesta);
  }
);

export const obtenerActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const activo: ActivoDetalle = await obtenerPorId(Number(textoId));

    res.status(200).json({
      success: true,
      message: 'Activo obtenido correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const crearActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const tipo = comoTexto(cuerpo.tipo);

    if (tipo === '') {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        { campo: 'tipo', valor: '', mensaje: 'El tipo es obligatorio' },
      ]);
    }

    const estado = validarCampoOpcion(cuerpo.estado, 'estado', ESTADOS_DE_ACTIVO);

    const texto = (campo: string): string | null => {
      const valor = comoTexto(cuerpo[campo]);
      return valor === '' ? null : valor;
    };

    const responsableId = texto('responsableId');

    const datos: DatosCreacionActivo = {
      tipo,
      claveActivo: texto('claveActivo'),
      cb23: texto('cb23'),
      marca: texto('marca'),
      modelo: texto('modelo'),
      numeroParte: texto('numeroParte'),
      numeroSerie: texto('numeroSerie'),
      sucursal: texto('sucursal'),
      anydesk: texto('anydesk'),
      nombreRed: texto('nombreRed'),
      procesador: texto('procesador'),
      memoria: texto('memoria'),
      estadoGeneral: texto('estadoGeneral'),
      notas: texto('notas'),
      ...(estado
        ? { estado: estado as (typeof ESTADOS_DE_ACTIVO)[number] }
        : {}),
      ...(responsableId ? { responsableId } : {}),
    };

    const activo: ActivoDetalle = await crear(datos);

    res.status(201).json({
      success: true,
      message: 'Activo creado correctamente',
      errors: [],
      data: activo,
    });
  }
);
