import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  crearGeneracionReporte,
  descargarGeneracion,
  generarReporte,
  listarCatalogoReportes,
  listarGeneraciones,
  obtenerGeneracion,
  obtenerMetadataReporte,
} from '../services/reportes/reporte.service';
import { asyncHandler } from '../utils/asyncHandler';

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

export const listarReportesController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Catálogo de reportes obtenido correctamente',
      errors: [],
      data: listarCatalogoReportes(),
    });
  }
);

export const obtenerReporteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = req.params.codigo;
    if (typeof codigo !== 'string' || codigo.trim() === '') {
      throw new HttpError(400, 'El parámetro "codigo" es obligatorio', [
        { campo: 'codigo', valor: codigo ?? null },
      ]);
    }
    res.status(200).json({
      success: true,
      message: 'Definición de reporte obtenida correctamente',
      errors: [],
      data: obtenerMetadataReporte(codigo),
    });
  }
);

export const descargarReporteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = req.params.codigo;
    if (typeof codigo !== 'string' || codigo.trim() === '') {
      throw new HttpError(400, 'El parámetro "codigo" es obligatorio', [
        { campo: 'codigo', valor: codigo ?? null },
      ]);
    }

    const { formato, ...filtros } = req.query as Record<string, unknown>;
    const descarga = await generarReporte(
      codigo,
      formato,
      filtros,
      obtenerUsuario(req)
    );

    res.setHeader('Content-Type', descarga.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${descarga.filename}"`
    );
    res.setHeader('Content-Length', String(descarga.buffer.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(descarga.buffer);
  }
);

export const crearGeneracionReporteController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = req.params.codigo;
    if (typeof codigo !== 'string' || codigo.trim() === '') {
      throw new HttpError(400, 'El parámetro "codigo" es obligatorio', [
        { campo: 'codigo', valor: codigo ?? null },
      ]);
    }
    const { formato, ...filtros } = req.query as Record<string, unknown>;
    const generacion = await crearGeneracionReporte(
      codigo,
      formato,
      filtros,
      obtenerUsuario(req)
    );
    res.status(202).json({
      success: true,
      message: 'Generación de reporte programada correctamente',
      errors: [],
      data: generacion,
    });
  }
);

export const listarGeneracionesController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const resultado = await listarGeneraciones(
      obtenerUsuario(req).id,
      leerPaginacion(req)
    );
    res.status(200).json({
      success: true,
      message: 'Generaciones de reportes obtenidas correctamente',
      errors: [],
      data: resultado.generaciones,
      meta: resultado.meta,
    });
  }
);

export const obtenerGeneracionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Generación de reporte obtenida correctamente',
      errors: [],
      data: await obtenerGeneracion(
        leerId(req.params.id),
        obtenerUsuario(req).id
      ),
    });
  }
);

export const descargarGeneracionController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).json({
      success: true,
      message: 'URL de descarga generada correctamente',
      errors: [],
      data: await descargarGeneracion(
        leerId(req.params.id),
        obtenerUsuario(req).id
      ),
    });
  }
);
