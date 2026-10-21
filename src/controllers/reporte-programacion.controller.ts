import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionProgramacion,
  DatosEdicionProgramacion,
  FormatoReporte,
} from '../models/reporte.model';
import {
  actualizarProgramacion,
  crearProgramacion,
  desactivarProgramacion,
  listarProgramaciones,
  obtenerProgramacion,
} from '../services/reportes/reporte-programacion.service';
import { asyncHandler } from '../utils/asyncHandler';

const CAMPOS_PROGRAMACION = new Set([
  'codigo',
  'formato',
  'parametros',
  'cron',
  'destinatarios',
  'activo',
]);
const FORMATOS: FormatoReporte[] = ['xlsx', 'csv', 'pdf'];

const obtenerUsuario = (req: Request) => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticación requerida');
  }
  return req.usuario;
};

const leerId = (valor: unknown): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, 'El parámetro "id" debe ser un entero positivo', [
      { campo: 'id', valor: String(valor ?? '') },
    ]);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, 'El parámetro "id" está fuera de rango', [
      { campo: 'id', valor },
    ]);
  }
  return id;
};

const leerPaginacion = (req: Request): { page: number; limit: number } => {
  const leerEntero = (valor: unknown, campo: string, defecto: number): number => {
    if (valor === undefined) return defecto;
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
  if (limit < 1 || limit > 100) {
    throw new HttpError(400, 'El parámetro "limit" debe estar entre 1 y 100', [
      { campo: 'limit', valor: String(limit) },
    ]);
  }
  return { page, limit };
};

const leerCuerpo = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !CAMPOS_PROGRAMACION.has(campo)
  );
  if (desconocidos.length > 0) {
    throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
      { campo: 'campos', valor: desconocidos },
    ]);
  }
  return cuerpo;
};

const leerTexto = (valor: unknown, campo: string): string => {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new HttpError(400, `El campo "${campo}" es obligatorio`, [
      { campo, valor: valor ?? null },
    ]);
  }
  return valor.trim();
};

const leerFormato = (valor: unknown): FormatoReporte => {
  if (typeof valor !== 'string' || !FORMATOS.includes(valor as FormatoReporte)) {
    throw new HttpError(
      400,
      'El campo "formato" debe ser xlsx, csv o pdf',
      [{ campo: 'formato', valor: valor ?? null }]
    );
  }
  return valor as FormatoReporte;
};

const leerParametros = (valor: unknown): Record<string, unknown> => {
  if (valor === undefined) return {};
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El campo "parametros" debe ser un objeto', [
      { campo: 'parametros', valor },
    ]);
  }
  return valor as Record<string, unknown>;
};

const leerDestinatarios = (valor: unknown): string[] => {
  if (!Array.isArray(valor)) {
    throw new HttpError(400, 'El campo "destinatarios" debe ser un arreglo', [
      { campo: 'destinatarios', valor: valor ?? null },
    ]);
  }
  return valor.map((correo) => {
    if (typeof correo !== 'string' || correo.trim() === '') {
      throw new HttpError(
        400,
        'Todos los destinatarios deben ser correos válidos',
        [{ campo: 'destinatarios', valor: correo ?? null }]
      );
    }
    return correo.trim();
  });
};

export const listarProgramacionesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const resultado = await listarProgramaciones(
      obtenerUsuario(req).id,
      leerPaginacion(req)
    );
    res.status(200).json({
      success: true,
      message: 'Programaciones de reportes obtenidas correctamente',
      errors: [],
      data: resultado.programaciones,
      meta: resultado.meta,
    });
  }
);

export const obtenerProgramacionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Programación de reporte obtenida correctamente',
      errors: [],
      data: await obtenerProgramacion(
        leerId(req.params.id),
        obtenerUsuario(req).id
      ),
    });
  }
);

export const crearProgramacionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const datos: DatosCreacionProgramacion = {
      codigo: leerTexto(cuerpo.codigo, 'codigo'),
      formato:
        cuerpo.formato === undefined ? 'xlsx' : leerFormato(cuerpo.formato),
      parametros: leerParametros(cuerpo.parametros),
      cron: leerTexto(cuerpo.cron, 'cron'),
      destinatarios:
        cuerpo.destinatarios === undefined
          ? []
          : leerDestinatarios(cuerpo.destinatarios),
    };

    const programacion = await crearProgramacion(datos, obtenerUsuario(req));
    res.status(201).json({
      success: true,
      message: 'Programación de reporte creada correctamente',
      errors: [],
      data: programacion,
    });
  }
);

export const actualizarProgramacionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionProgramacion = {};
    if ('formato' in cuerpo) datos.formato = leerFormato(cuerpo.formato);
    if ('parametros' in cuerpo) {
      datos.parametros = leerParametros(cuerpo.parametros);
    }
    if ('cron' in cuerpo) datos.cron = leerTexto(cuerpo.cron, 'cron');
    if ('destinatarios' in cuerpo) {
      datos.destinatarios = leerDestinatarios(cuerpo.destinatarios);
    }
    if ('activo' in cuerpo) {
      if (typeof cuerpo.activo !== 'boolean') {
        throw new HttpError(400, 'El campo "activo" debe ser booleano', [
          { campo: 'activo', valor: cuerpo.activo ?? null },
        ]);
      }
      datos.activo = cuerpo.activo;
    }

    const programacion = await actualizarProgramacion(
      leerId(req.params.id),
      obtenerUsuario(req).id,
      datos
    );
    res.status(200).json({
      success: true,
      message: 'Programación de reporte actualizada correctamente',
      errors: [],
      data: programacion,
    });
  }
);

export const desactivarProgramacionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const programacion = await desactivarProgramacion(
      leerId(req.params.id),
      obtenerUsuario(req).id
    );
    res.status(200).json({
      success: true,
      message: 'Programación de reporte desactivada correctamente',
      errors: [],
      data: programacion,
    });
  }
);
