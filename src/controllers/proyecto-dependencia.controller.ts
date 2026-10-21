import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  agregarDependencia,
  eliminarDependencia,
  listarDependencias,
} from '../services/proyecto-dependencia.service';
import { asyncHandler } from '../utils/asyncHandler';

const CAMPOS_DEPENDENCIA = new Set(['dependeDeId']);

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

const leerId = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, `El parametro "${campo}" debe ser un entero positivo`, [
      { campo, valor: String(valor ?? '') },
    ]);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, `El parametro "${campo}" esta fuera de rango`, [
      { campo, valor },
    ]);
  }
  return id;
};

const leerDependeDeId = (valor: unknown): number => {
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(
      400,
      'El campo "dependeDeId" debe ser un entero positivo',
      [{ campo: 'dependeDeId', valor: valor ?? null }]
    );
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 2147483647) {
    throw new HttpError(
      400,
      'El campo "dependeDeId" debe ser un entero positivo',
      [{ campo: 'dependeDeId', valor }]
    );
  }
  return numero;
};

export const listarDependenciasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Dependencias de la tarea obtenidas correctamente',
      errors: [],
      data: await listarDependencias(
        leerId(req.params.id, 'id'),
        leerId(req.params.tareaId, 'tareaId')
      ),
    });
  }
);

export const agregarDependenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (
      typeof req.body !== 'object' ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
    }
    const cuerpo = req.body as Record<string, unknown>;
    const desconocidos = Object.keys(cuerpo).filter(
      (campo) => !CAMPOS_DEPENDENCIA.has(campo)
    );
    if (desconocidos.length > 0) {
      throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
        { campo: 'campos', valor: desconocidos },
      ]);
    }
    if (!('dependeDeId' in cuerpo)) {
      throw new HttpError(400, 'El campo "dependeDeId" es obligatorio', [
        { campo: 'dependeDeId', valor: null },
      ]);
    }

    const data = await agregarDependencia(
      leerId(req.params.id, 'id'),
      leerId(req.params.tareaId, 'tareaId'),
      leerDependeDeId(cuerpo.dependeDeId),
      obtenerUsuarioId(req)
    );

    res.status(201).json({
      success: true,
      message: 'Dependencia agregada correctamente',
      errors: [],
      data,
    });
  }
);

export const eliminarDependenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await eliminarDependencia(
      leerId(req.params.id, 'id'),
      leerId(req.params.tareaId, 'tareaId'),
      leerId(req.params.dependeDeId, 'dependeDeId'),
      obtenerUsuarioId(req)
    );
    res.status(204).send();
  }
);
