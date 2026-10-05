import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  CatalogoAdministrable,
  TipoCatalogo,
} from '../models/catalogo.model';

const seleccionarCampos = {
  id: true,
  nombre: true,
  activo: true,
} as const;

type CambiosCatalogo = { nombre?: string; activo?: boolean };

interface AdaptadorCatalogo {
  listar(): Promise<CatalogoAdministrable[]>;
  buscarPorId(id: number): Promise<CatalogoAdministrable | null>;
  buscarActivoPorId(id: number): Promise<CatalogoAdministrable | null>;
  buscarPorNombre(nombre: string): Promise<CatalogoAdministrable | null>;
  crear(nombre: string): Promise<CatalogoAdministrable>;
  actualizar(
    id: number,
    cambios: CambiosCatalogo
  ): Promise<CatalogoAdministrable>;
}

const adaptadores: Record<TipoCatalogo, AdaptadorCatalogo> = {
  departamento: {
    listar: () =>
      prisma.departamento.findMany({
        where: { activo: true },
        select: seleccionarCampos,
        orderBy: { nombre: 'asc' },
      }),
    buscarPorId: (id) =>
      prisma.departamento.findUnique({ where: { id }, select: seleccionarCampos }),
    buscarActivoPorId: (id) =>
      prisma.departamento.findFirst({
        where: { id, activo: true },
        select: seleccionarCampos,
      }),
    buscarPorNombre: (nombre) =>
      prisma.departamento.findUnique({
        where: { nombre },
        select: seleccionarCampos,
      }),
    crear: (nombre) =>
      prisma.departamento.create({
        data: { nombre },
        select: seleccionarCampos,
      }),
    actualizar: (id, cambios) =>
      prisma.departamento.update({
        where: { id },
        data: cambios,
        select: seleccionarCampos,
      }),
  },
  ubicacion: {
    listar: () =>
      prisma.ubicacion.findMany({
        where: { activo: true },
        select: seleccionarCampos,
        orderBy: { nombre: 'asc' },
      }),
    buscarPorId: (id) =>
      prisma.ubicacion.findUnique({ where: { id }, select: seleccionarCampos }),
    buscarActivoPorId: (id) =>
      prisma.ubicacion.findFirst({
        where: { id, activo: true },
        select: seleccionarCampos,
      }),
    buscarPorNombre: (nombre) =>
      prisma.ubicacion.findUnique({
        where: { nombre },
        select: seleccionarCampos,
      }),
    crear: (nombre) =>
      prisma.ubicacion.create({
        data: { nombre },
        select: seleccionarCampos,
      }),
    actualizar: (id, cambios) =>
      prisma.ubicacion.update({
        where: { id },
        data: cambios,
        select: seleccionarCampos,
      }),
  },
  puesto: {
    listar: () =>
      prisma.puesto.findMany({
        where: { activo: true },
        select: seleccionarCampos,
        orderBy: { nombre: 'asc' },
      }),
    buscarPorId: (id) =>
      prisma.puesto.findUnique({ where: { id }, select: seleccionarCampos }),
    buscarActivoPorId: (id) =>
      prisma.puesto.findFirst({
        where: { id, activo: true },
        select: seleccionarCampos,
      }),
    buscarPorNombre: (nombre) =>
      prisma.puesto.findUnique({
        where: { nombre },
        select: seleccionarCampos,
      }),
    crear: (nombre) =>
      prisma.puesto.create({
        data: { nombre },
        select: seleccionarCampos,
      }),
    actualizar: (id, cambios) =>
      prisma.puesto.update({
        where: { id },
        data: cambios,
        select: seleccionarCampos,
      }),
  },
  tipoUsuario: {
    listar: () =>
      prisma.tipoUsuario.findMany({
        where: { activo: true },
        select: seleccionarCampos,
        orderBy: { nombre: 'asc' },
      }),
    buscarPorId: (id) =>
      prisma.tipoUsuario.findUnique({ where: { id }, select: seleccionarCampos }),
    buscarActivoPorId: (id) =>
      prisma.tipoUsuario.findFirst({
        where: { id, activo: true },
        select: seleccionarCampos,
      }),
    buscarPorNombre: (nombre) =>
      prisma.tipoUsuario.findUnique({
        where: { nombre },
        select: seleccionarCampos,
      }),
    crear: (nombre) =>
      prisma.tipoUsuario.create({
        data: { nombre },
        select: seleccionarCampos,
      }),
    actualizar: (id, cambios) =>
      prisma.tipoUsuario.update({
        where: { id },
        data: cambios,
        select: seleccionarCampos,
      }),
  },
};

const manejarNombreDuplicado = (error: unknown, nombre: string): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new HttpError(409, 'Ya existe un catalogo con ese nombre', [
      { campo: 'nombre', valor: nombre },
    ]);
  }
  throw error;
};

const lanzarNoEncontrado = (tipo: TipoCatalogo, id: number): never => {
  throw new HttpError(404, 'Catalogo no encontrado', [
    { campo: 'tipo', valor: tipo },
    { campo: 'id', valor: id },
  ]);
};

export const listarCatalogosAdministrables = (
  tipo: TipoCatalogo
): Promise<CatalogoAdministrable[]> => adaptadores[tipo].listar();

export const obtenerCatalogoAdministrable = async (
  tipo: TipoCatalogo,
  id: number
): Promise<CatalogoAdministrable> => {
  const catalogo = await adaptadores[tipo].buscarActivoPorId(id);
  return catalogo ?? lanzarNoEncontrado(tipo, id);
};

export const crearCatalogoAdministrable = async (
  tipo: TipoCatalogo,
  nombre: string
): Promise<{ catalogo: CatalogoAdministrable; reactivado: boolean }> => {
  const adaptador = adaptadores[tipo];
  try {
    const existente = await adaptador.buscarPorNombre(nombre);
    if (existente) {
      if (existente.activo) {
        throw new HttpError(409, 'Ya existe un catalogo con ese nombre', [
          { campo: 'nombre', valor: nombre },
        ]);
      }
      return {
        catalogo: await adaptador.actualizar(existente.id, { activo: true }),
        reactivado: true,
      };
    }
    return { catalogo: await adaptador.crear(nombre), reactivado: false };
  } catch (error: unknown) {
    return manejarNombreDuplicado(error, nombre);
  }
};

export const actualizarCatalogoAdministrable = async (
  tipo: TipoCatalogo,
  id: number,
  nombre: string
): Promise<CatalogoAdministrable> => {
  const adaptador = adaptadores[tipo];
  if (!(await adaptador.buscarActivoPorId(id))) {
    return lanzarNoEncontrado(tipo, id);
  }
  try {
    return await adaptador.actualizar(id, { nombre });
  } catch (error: unknown) {
    return manejarNombreDuplicado(error, nombre);
  }
};

export const desactivarCatalogoAdministrable = async (
  tipo: TipoCatalogo,
  id: number
): Promise<CatalogoAdministrable> => {
  const adaptador = adaptadores[tipo];
  const catalogo = await adaptador.buscarPorId(id);
  if (!catalogo) return lanzarNoEncontrado(tipo, id);
  if (!catalogo.activo) return catalogo;
  return adaptador.actualizar(id, { activo: false });
};
