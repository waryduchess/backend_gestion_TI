import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionRol,
  DatosEdicionRol,
  PERMISOS_DISPONIBLES,
  Permiso,
  Rol,
} from '../models/rol.model';

const incluirCampos = {
  id: true,
  nombre: true,
  permisos: true,
  activo: true,
} as const;

type FilaRol = Prisma.RolGetPayload<{ select: typeof incluirCampos }>;

const mapearRol = (fila: FilaRol): Rol => {
  if (
    !Array.isArray(fila.permisos) ||
    !fila.permisos.every(
      (permiso): permiso is Permiso =>
        typeof permiso === 'string' &&
        PERMISOS_DISPONIBLES.includes(permiso as Permiso)
    )
  ) {
    throw new Error(`El rol ${fila.id} contiene permisos invalidos`);
  }

  return {
    id: fila.id,
    nombre: fila.nombre,
    permisos: fila.permisos,
    activo: fila.activo,
  };
};

const manejarNombreDuplicado = (error: unknown, nombre: string): never => {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new HttpError(409, 'Ya existe un rol con ese nombre', [
      { campo: 'nombre', valor: nombre },
    ]);
  }
  throw error;
};

const obtenerFilaActiva = async (id: number): Promise<FilaRol> => {
  const fila = await prisma.rol.findFirst({
    where: { id, activo: true },
    select: incluirCampos,
  });

  if (!fila) {
    throw new HttpError(404, 'Rol no encontrado', [{ campo: 'id', valor: id }]);
  }

  return fila;
};

export const listarRoles = async (): Promise<Rol[]> => {
  const filas = await prisma.rol.findMany({
    where: { activo: true },
    select: incluirCampos,
    orderBy: { nombre: 'asc' },
  });

  return filas.map(mapearRol);
};

export const obtenerRol = async (id: number): Promise<Rol> =>
  mapearRol(await obtenerFilaActiva(id));

export const crearRol = async (datos: DatosCreacionRol): Promise<Rol> => {
  try {
    const fila = await prisma.rol.create({
      data: {
        nombre: datos.nombre,
        permisos: datos.permisos,
      },
      select: incluirCampos,
    });
    return mapearRol(fila);
  } catch (error: unknown) {
    return manejarNombreDuplicado(error, datos.nombre);
  }
};

export const actualizarRol = async (
  id: number,
  datos: DatosEdicionRol
): Promise<Rol> => {
  const rol = await prisma.rol.findUnique({
    where: { id },
    select: incluirCampos,
  });
  if (!rol || (!rol.activo && datos.activo !== true)) {
    throw new HttpError(404, 'Rol no encontrado', [{ campo: 'id', valor: id }]);
  }

  if (
    rol.activo &&
    datos.permisos !== undefined &&
    !datos.permisos.includes('roles:administrar')
  ) {
    const otrosAdministradores = await prisma.rol.findMany({
      where: { activo: true, id: { not: id } },
      select: { permisos: true },
    });
    const existeOtroAdministrador = otrosAdministradores.some(
      (otroRol) =>
        Array.isArray(otroRol.permisos) &&
        otroRol.permisos.includes('roles:administrar')
    );
    if (!existeOtroAdministrador) {
      throw new HttpError(
        409,
        'No se puede quitar el ultimo permiso para administrar roles',
        [{ campo: 'permisos', valor: 'roles:administrar' }]
      );
    }
  }

  try {
    const fila = await prisma.rol.update({
      where: { id },
      data: datos,
      select: incluirCampos,
    });
    return mapearRol(fila);
  } catch (error: unknown) {
    return manejarNombreDuplicado(error, datos.nombre ?? '');
  }
};

export const desactivarRol = async (id: number): Promise<Rol> => {
  const rolExistente = await prisma.rol.findUnique({
    where: { id },
    select: incluirCampos,
  });
  if (!rolExistente) {
    throw new HttpError(404, 'Rol no encontrado', [{ campo: 'id', valor: id }]);
  }
  if (!rolExistente.activo) {
    return mapearRol(rolExistente);
  }

  if (
    Array.isArray(rolExistente.permisos) &&
    rolExistente.permisos.includes('roles:administrar')
  ) {
    const otrosAdministradores = await prisma.rol.findMany({
      where: { activo: true, id: { not: id } },
      select: { permisos: true },
    });
    const existeOtroAdministrador = otrosAdministradores.some(
      (otroRol) =>
        Array.isArray(otroRol.permisos) &&
        otroRol.permisos.includes('roles:administrar')
    );
    if (!existeOtroAdministrador) {
      throw new HttpError(
        409,
        'No se puede desactivar el ultimo rol con permiso para administrar roles',
        [{ campo: 'id', valor: id }]
      );
    }
  }

  const usuariosAsignados = await prisma.usuario.count({ where: { rolId: id } });

  if (usuariosAsignados > 0) {
    throw new HttpError(409, 'No se puede desactivar un rol asignado a usuarios', [
      { campo: 'id', valor: id, usuariosAsignados },
    ]);
  }

  const fila = await prisma.rol.update({
    where: { id },
    data: { activo: false },
    select: incluirCampos,
  });

  return mapearRol(fila);
};
