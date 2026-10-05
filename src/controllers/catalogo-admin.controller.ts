import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { TipoCatalogo } from '../models/catalogo.model';
import {
  actualizarCatalogoAdministrable,
  crearCatalogoAdministrable,
  desactivarCatalogoAdministrable,
  listarCatalogosAdministrables,
  obtenerCatalogoAdministrable,
} from '../services/catalogo-admin.service';
import { asyncHandler } from '../utils/asyncHandler';

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

const leerCuerpo = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  return valor as Record<string, unknown>;
};

const mensajeCatalogo = (tipo: TipoCatalogo): string => {
  switch (tipo) {
    case 'departamento':
      return 'Departamento';
    case 'ubicacion':
      return 'Ubicacion';
    case 'puesto':
      return 'Puesto';
    case 'tipoUsuario':
      return 'Tipo de usuario';
  }
};

const mensajeCatalogoPlural = (tipo: TipoCatalogo): string => {
  switch (tipo) {
    case 'departamento':
      return 'Departamentos';
    case 'ubicacion':
      return 'Ubicaciones';
    case 'puesto':
      return 'Puestos';
    case 'tipoUsuario':
      return 'Tipos de usuario';
  }
};

export const crearControladorCatalogoAdministrable = (tipo: TipoCatalogo) => ({
  listar: asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: `${mensajeCatalogoPlural(tipo)} obtenidos correctamente`,
      errors: [],
      data: await listarCatalogosAdministrables(tipo),
    });
  }),

  obtener: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const catalogo = await obtenerCatalogoAdministrable(tipo, leerId(req.params.id));
    res.status(200).json({
      success: true,
      message: `${mensajeCatalogo(tipo)} obtenido correctamente`,
      errors: [],
      data: catalogo,
    });
  }),

  crear: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).some((campo) => campo !== 'nombre')) {
      throw new HttpError(400, 'Solo se permite el campo "nombre"', []);
    }
    const resultado = await crearCatalogoAdministrable(
      tipo,
      leerNombre(cuerpo.nombre)
    );
    res.status(resultado.reactivado ? 200 : 201).json({
      success: true,
      message: resultado.reactivado
        ? `${mensajeCatalogo(tipo)} reactivado correctamente`
        : `${mensajeCatalogo(tipo)} creado correctamente`,
      errors: [],
      data: resultado.catalogo,
    });
  }),

  actualizar: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length !== 1 || !('nombre' in cuerpo)) {
      throw new HttpError(400, 'Se requiere unicamente el campo "nombre"', [
        { campo: 'nombre', valor: cuerpo.nombre ?? null },
      ]);
    }
    const catalogo = await actualizarCatalogoAdministrable(
      tipo,
      leerId(req.params.id),
      leerNombre(cuerpo.nombre)
    );
    res.status(200).json({
      success: true,
      message: `${mensajeCatalogo(tipo)} actualizado correctamente`,
      errors: [],
      data: catalogo,
    });
  }),

  eliminar: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const catalogo = await desactivarCatalogoAdministrable(
      tipo,
      leerId(req.params.id)
    );
    res.status(200).json({
      success: true,
      message: `${mensajeCatalogo(tipo)} desactivado correctamente`,
      errors: [],
      data: catalogo,
    });
  }),
});
