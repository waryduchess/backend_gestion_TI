import { Request, Response } from 'express';
import { PrioridadRecordatorio } from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionRecordatorio,
  DatosEdicionRecordatorio,
  ParametrosListadoRecordatorios,
  PRIORIDADES_RECORDATORIO,
} from '../models/recordatorio.model';
import {
  actualizarRecordatorio,
  completarRecordatorio,
  crearRecordatorio,
  desactivarRecordatorio,
  listarRecordatorios,
  obtenerRecordatorio,
} from '../services/recordatorio.service';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoTexto, validarOpcion } from '../utils/validacion';

const LIMITE_MAXIMO = 100;
const CAMPOS_PERMITIDOS = new Set([
  'titulo',
  'descripcion',
  'fecha',
  'prioridad',
]);

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

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

const leerCuerpo = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !CAMPOS_PERMITIDOS.has(campo)
  );
  if (desconocidos.length > 0) {
    throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
      { campo: 'campos', valor: desconocidos },
    ]);
  }
  return cuerpo;
};

const leerTitulo = (valor: unknown): string => {
  const titulo = typeof valor === 'string' ? valor.trim() : '';
  if (titulo === '') {
    throw new HttpError(400, 'El campo "titulo" es obligatorio', [
      { campo: 'titulo', valor: '' },
    ]);
  }
  if (titulo.length > 200) {
    throw new HttpError(400, 'El campo "titulo" no puede exceder 200 caracteres', [
      { campo: 'titulo', valor: titulo },
    ]);
  }
  return titulo;
};

const leerDescripcion = (valor: unknown): string | null => {
  if (valor === null) return null;
  if (typeof valor !== 'string') {
    throw new HttpError(400, 'El campo "descripcion" debe ser texto', [
      { campo: 'descripcion', valor: valor ?? null },
    ]);
  }
  const descripcion = valor.trim();
  if (descripcion.length > 10000) {
    throw new HttpError(
      400,
      'El campo "descripcion" no puede exceder 10000 caracteres',
      [{ campo: 'descripcion', valor: descripcion }]
    );
  }
  return descripcion === '' ? null : descripcion;
};

const leerFecha = (valor: unknown): Date | null => {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor !== 'string') {
    throw new HttpError(400, 'El campo "fecha" debe ser una fecha valida', [
      { campo: 'fecha', valor: valor ?? null },
    ]);
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new HttpError(400, 'El campo "fecha" debe ser una fecha valida', [
      { campo: 'fecha', valor },
    ]);
  }
  return fecha;
};

const leerPrioridad = (valor: unknown): PrioridadRecordatorio => {
  const prioridad = validarOpcion(
    valor,
    'prioridad',
    PRIORIDADES_RECORDATORIO
  );
  if (!prioridad) {
    throw new HttpError(400, 'El campo "prioridad" es obligatorio', [
      { campo: 'prioridad', valor: valor ?? null },
    ]);
  }
  return prioridad as PrioridadRecordatorio;
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
    throw new HttpError(400, `El parametro "${campo}" no contiene una fecha valida`, [
      { campo, valor },
    ]);
  }
  return fecha;
};

const leerPaginacion = (req: Request): { page: number; limit: number } => {
  const page = comoEntero(req.query.page, 'page', 1);
  const limit = comoEntero(req.query.limit, 'limit', 20);
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

const leerBooleanoQuery = (
  valor: unknown,
  campo: string
): boolean | undefined => {
  const texto = validarOpcion(valor, campo, ['true', 'false']);
  return texto === undefined ? undefined : texto === 'true';
};

export const listarRecordatoriosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const paginacion = leerPaginacion(req);
    const q = comoTexto(req.query.q) || undefined;
    const completado = leerBooleanoQuery(req.query.completado, 'completado');
    const prioridadTexto = validarOpcion(
      req.query.prioridad,
      'prioridad',
      PRIORIDADES_RECORDATORIO
    );
    const sinFecha = leerBooleanoQuery(req.query.sinFecha, 'sinFecha');
    const desde = leerFechaQuery(req.query.desde, 'desde');
    const hasta = leerFechaQuery(req.query.hasta, 'hasta');

    if (sinFecha && (desde || hasta)) {
      throw new HttpError(
        400,
        'No se puede combinar "sinFecha" con "desde" o "hasta"',
        [{ campo: 'sinFecha', valor: true }]
      );
    }
    if (desde && hasta && desde > hasta) {
      throw new HttpError(
        400,
        'El parametro "desde" no puede ser posterior a "hasta"',
        [{ campo: 'desde', valor: desde.toISOString() }]
      );
    }
    if (hasta) {
      hasta.setUTCHours(23, 59, 59, 999);
    }

    const parametros: ParametrosListadoRecordatorios = {
      usuarioId: obtenerUsuarioId(req),
      ...paginacion,
      ...(q ? { q } : {}),
      ...(completado !== undefined ? { completado } : {}),
      ...(prioridadTexto
        ? { prioridad: prioridadTexto as PrioridadRecordatorio }
        : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
      ...(sinFecha !== undefined ? { sinFecha } : {}),
    };

    const resultado = await listarRecordatorios(parametros);

    res.status(200).json({
      success: true,
      message: 'Recordatorios obtenidos correctamente',
      errors: [],
      data: resultado.recordatorios,
      meta: resultado.meta,
    });
  }
);

export const obtenerRecordatorioController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Recordatorio obtenido correctamente',
      errors: [],
      data: await obtenerRecordatorio(
        obtenerUsuarioId(req),
        leerId(req.params.id)
      ),
    });
  }
);

export const crearRecordatorioController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const datos: DatosCreacionRecordatorio = {
      titulo: leerTitulo(cuerpo.titulo),
      descripcion:
        'descripcion' in cuerpo ? leerDescripcion(cuerpo.descripcion) : null,
      fecha: 'fecha' in cuerpo ? leerFecha(cuerpo.fecha) : null,
      prioridad:
        'prioridad' in cuerpo
          ? leerPrioridad(cuerpo.prioridad)
          : PrioridadRecordatorio.MEDIA,
    };

    const recordatorio = await crearRecordatorio(
      datos,
      obtenerUsuarioId(req)
    );

    res.status(201).json({
      success: true,
      message: 'Recordatorio creado correctamente',
      errors: [],
      data: recordatorio,
    });
  }
);

export const actualizarRecordatorioController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(
        400,
        'Se requiere al menos un campo para actualizar',
        []
      );
    }

    const datos: DatosEdicionRecordatorio = {};
    if ('titulo' in cuerpo) datos.titulo = leerTitulo(cuerpo.titulo);
    if ('descripcion' in cuerpo) {
      datos.descripcion = leerDescripcion(cuerpo.descripcion);
    }
    if ('fecha' in cuerpo) datos.fecha = leerFecha(cuerpo.fecha);
    if ('prioridad' in cuerpo) {
      datos.prioridad = leerPrioridad(cuerpo.prioridad);
    }

    const recordatorio = await actualizarRecordatorio(
      obtenerUsuarioId(req),
      leerId(req.params.id),
      datos
    );

    res.status(200).json({
      success: true,
      message: 'Recordatorio actualizado correctamente',
      errors: [],
      data: recordatorio,
    });
  }
);

export const completarRecordatorioController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    if (typeof cuerpo.completado !== 'boolean') {
      throw new HttpError(400, 'El campo "completado" debe ser booleano', [
        { campo: 'completado', valor: cuerpo.completado ?? null },
      ]);
    }
    const desconocidos = Object.keys(cuerpo).filter(
      (campo) => campo !== 'completado'
    );
    if (desconocidos.length > 0) {
      throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
        { campo: 'campos', valor: desconocidos },
      ]);
    }

    const recordatorio = await completarRecordatorio(
      obtenerUsuarioId(req),
      leerId(req.params.id),
      cuerpo.completado
    );

    res.status(200).json({
      success: true,
      message: cuerpo.completado
        ? 'Recordatorio marcado como completado'
        : 'Recordatorio marcado como pendiente',
      errors: [],
      data: recordatorio,
    });
  }
);

export const eliminarRecordatorioController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await desactivarRecordatorio(
      obtenerUsuarioId(req),
      leerId(req.params.id)
    );
    res.status(204).send();
  }
);
