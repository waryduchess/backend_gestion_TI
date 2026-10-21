import { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  puedeVerTodosProyectos,
  tieneAccesoProyecto,
} from '../utils/proyecto-visibilidad';

export const verificarAccesoProyecto = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.usuario) {
      throw new HttpError(401, 'Autenticacion requerida');
    }
    const valor = req.params.id;
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
      throw new HttpError(400, 'El parametro "id" debe ser un entero positivo', [
        { campo: 'id', valor: String(valor ?? '') },
      ]);
    }

    const proyectoId = Number(valor);
    const verTodos = await puedeVerTodosProyectos(req.usuario.id);
    const acceso = await tieneAccesoProyecto(
      proyectoId,
      req.usuario.id,
      verTodos
    );
    if (!acceso) {
      throw new HttpError(404, 'Proyecto no encontrado', [
        { campo: 'id', valor: proyectoId },
      ]);
    }
    next();
  }
);
