import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { validarOpcion } from '../utils/validacion';
import {
  obtenerAuditoria,
  listarAuditoria,
} from '../services/auditoria.service';
import {
  ACCIONES_AUDITORIA,
  MODULOS_AUDITORIA,
  ParametrosListadoAuditoriaGlobal,
} from '../models/auditoria.model';

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

const leerTextoQuery = (valor: unknown, campo: string): string | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El parametro "${campo}" debe ser texto`, []);
  }
  const texto = valor.trim();
  return texto || undefined;
};

const leerFechaQuery = (valor: unknown, campo: string): Date | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new HttpError(
      400,
      `El parametro "${campo}" debe tener el formato YYYY-MM-DD`,
      [{ campo, valor: String(valor) }]
    );
  }
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !== valor
  ) {
    throw new HttpError(
      400,
      `El parametro "${campo}" no contiene una fecha valida`,
      [{ campo, valor }]
    );
  }
  return fecha;
};

const leerPaginacion = (req: Request): { page: number; limit: number } => {
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
  return { page, limit };
};

export const listarAuditoriaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const paginacion = leerPaginacion(req);
    const modulo = validarOpcion(
      req.query.modulo,
      'modulo',
      [...MODULOS_AUDITORIA]
    );
    const accion = validarOpcion(
      req.query.accion,
      'accion',
      [...ACCIONES_AUDITORIA]
    );
    const usuarioId = leerTextoQuery(req.query.usuarioId, 'usuarioId');
    const entidadId = leerTextoQuery(req.query.entidadId, 'entidadId');
    const q = leerTextoQuery(req.query.q, 'q');
    const desde = leerFechaQuery(req.query.desde, 'desde');
    const hasta = leerFechaQuery(req.query.hasta, 'hasta');
    if (hasta) {
      hasta.setUTCHours(23, 59, 59, 999);
    }
    if (desde && hasta && desde > hasta) {
      throw new HttpError(
        400,
        'El parametro "desde" no puede ser posterior a "hasta"',
        [{ campo: 'desde', valor: desde.toISOString() }]
      );
    }

    const parametros: ParametrosListadoAuditoriaGlobal = {
      ...paginacion,
      ...(modulo ? { modulo } : {}),
      ...(accion ? { accion } : {}),
      ...(usuarioId ? { usuarioId } : {}),
      ...(entidadId ? { entidadId } : {}),
      ...(q ? { q } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    };

    const resultado = await listarAuditoria(parametros);
    res.status(200).json({
      success: true,
      message: 'Auditoria obtenida correctamente',
      errors: [],
      data: resultado.auditoria,
      meta: resultado.meta,
    });
  }
);

export const obtenerAuditoriaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Registro de auditoria obtenido correctamente',
      errors: [],
      data: await obtenerAuditoria(leerId(req.params.id)),
    });
  }
);
