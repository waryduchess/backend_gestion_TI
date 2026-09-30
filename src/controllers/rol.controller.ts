import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  crearRol,
  actualizarRol,
  desactivarRol,
  listarRoles,
  obtenerRol,
} from '../services/rol.service';
import {
  DatosCreacionRol,
  DatosEdicionRol,
  PERMISOS_DISPONIBLES,
  Permiso,
} from '../models/rol.model';

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

const leerPermisos = (valor: unknown): Permiso[] => {
  if (!Array.isArray(valor)) {
    throw new HttpError(400, 'El campo "permisos" debe ser un arreglo', [
      { campo: 'permisos', valor: null },
    ]);
  }

  const invalidos = valor.filter(
    (permiso): boolean =>
      typeof permiso !== 'string' ||
      !PERMISOS_DISPONIBLES.includes(permiso as Permiso)
  );

  if (invalidos.length > 0) {
    throw new HttpError(400, 'El rol contiene permisos no reconocidos', [
      {
        campo: 'permisos',
        valor: invalidos,
        permitidos: PERMISOS_DISPONIBLES,
      },
    ]);
  }

  if (new Set(valor).size !== valor.length) {
    throw new HttpError(400, 'El campo "permisos" no debe contener duplicados', [
      { campo: 'permisos', valor },
    ]);
  }

  return valor as Permiso[];
};

const leerNombre = (valor: unknown): string => {
  const nombre = typeof valor === 'string' ? valor.trim() : '';
  if (nombre === '') {
    throw new HttpError(400, 'El campo "nombre" es obligatorio', [
      { campo: 'nombre', valor: '' },
    ]);
  }
  if (nombre.length > 191) {
    throw new HttpError(400, 'El campo "nombre" no puede exceder 191 caracteres', [
      { campo: 'nombre', valor: nombre },
    ]);
  }
  return nombre;
};

export const listar = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Roles obtenidos correctamente',
      errors: [],
      data: await listarRoles(),
    });
  }
);

export const obtener = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rol = await obtenerRol(leerId(req.params.id));
    res.status(200).json({
      success: true,
      message: 'Rol obtenido correctamente',
      errors: [],
      data: rol,
    });
  }
);

export const crear = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const datos: DatosCreacionRol = {
      nombre: leerNombre(cuerpo.nombre),
      permisos: leerPermisos(cuerpo.permisos),
    };
    const rol = await crearRol(datos);
    res.status(201).json({
      success: true,
      message: 'Rol creado correctamente',
      errors: [],
      data: rol,
    });
  }
);

export const actualizar = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const datos: DatosEdicionRol = {};

    if ('nombre' in cuerpo) {
      datos.nombre = leerNombre(cuerpo.nombre);
    }
    if ('permisos' in cuerpo) {
      datos.permisos = leerPermisos(cuerpo.permisos);
    }
    if ('activo' in cuerpo) {
      if (cuerpo.activo !== true) {
        throw new HttpError(400, 'El campo "activo" solo puede reactivar un rol', [
          { campo: 'activo', valor: cuerpo.activo },
        ]);
      }
      datos.activo = true;
    }
    if (Object.keys(datos).length === 0) {
      throw new HttpError(400, 'Se requiere nombre o permisos para actualizar', []);
    }

    const rol = await actualizarRol(leerId(req.params.id), datos);
    res.status(200).json({
      success: true,
      message: 'Rol actualizado correctamente',
      errors: [],
      data: rol,
    });
  }
);

export const eliminar = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const rol = await desactivarRol(leerId(req.params.id));
    res.status(200).json({
      success: true,
      message: 'Rol desactivado correctamente',
      errors: [],
      data: rol,
    });
  }
);
