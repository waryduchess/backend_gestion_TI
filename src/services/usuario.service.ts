import bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionUsuario,
  DatosEdicionUsuario,
  ParametrosListadoUsuarios,
  ResultadoListadoUsuarios,
  UsuarioDetalle,
} from '../models/usuario.model';

const ROUNDS_BCRYPT = 10;

const SELECT_CATALOGOS = {
  include: {
    departamento: { select: { id: true, nombre: true } },
    ubicacion: { select: { id: true, nombre: true } },
    puesto: { select: { id: true, nombre: true } },
    tipoUsuario: { select: { id: true, nombre: true } },
    rol: { select: { id: true, nombre: true } },
  },
} as const;

type UsuarioConCatalogos = Prisma.UsuarioGetPayload<{
  include: typeof SELECT_CATALOGOS.include;
}>;

const mapear = (fila: UsuarioConCatalogos): UsuarioDetalle => ({
  id: fila.id,
  nombre: fila.nombre,
  email: fila.email,
  activo: fila.activo,
  fechaInicio: fila.fechaInicio,
  fechaFin: fila.fechaFin,
  departamento: fila.departamento,
  ubicacion: fila.ubicacion,
  puesto: fila.puesto,
  tipoUsuario: fila.tipoUsuario,
  rol: fila.rol,
});

const construirFiltros = (
  parametros: ParametrosListadoUsuarios
): Prisma.UsuarioWhereInput => {
  const { q, departamentoId, ubicacionId, puestoId, tipoUsuarioId, activo } =
    parametros;

  return {
    ...(q
      ? {
          OR: [
            { id: { contains: q } },
            { nombre: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
    ...(departamentoId !== undefined ? { departamentoId } : {}),
    ...(ubicacionId !== undefined ? { ubicacionId } : {}),
    ...(puestoId !== undefined ? { puestoId } : {}),
    ...(tipoUsuarioId !== undefined ? { tipoUsuarioId } : {}),
    ...(activo !== undefined ? { activo } : {}),
  };
};

const verificarCatalogo = async (
  campo: string,
  valor: number | null
): Promise<void> => {
  if (valor === null) {
    return;
  }

  let existe: { id: number } | null = null;

  switch (campo) {
    case 'departamentoId':
      existe = await prisma.departamento.findUnique({ where: { id: valor } });
      break;
    case 'ubicacionId':
      existe = await prisma.ubicacion.findUnique({ where: { id: valor } });
      break;
    case 'puestoId':
      existe = await prisma.puesto.findUnique({ where: { id: valor } });
      break;
    case 'tipoUsuarioId':
      existe = await prisma.tipoUsuario.findUnique({ where: { id: valor } });
      break;
    default:
      return;
  }

  if (!existe) {
    throw new HttpError(400, `El catalogo de "${campo}" no existe`, [
      { campo, valor, mensaje: 'El catalogo indicado no existe' },
    ]);
  }
};

export const listar = async (
  parametros: ParametrosListadoUsuarios
): Promise<ResultadoListadoUsuarios> => {
  const { page, limit } = parametros;
  const skip = (page - 1) * limit;
  const filtros = construirFiltros(parametros);

  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where: filtros,
      skip,
      take: limit,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      include: SELECT_CATALOGOS.include,
    }),
    prisma.usuario.count({ where: filtros }),
  ]);

  return {
    usuarios: filas.map(mapear),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const obtenerPorId = async (id: string): Promise<UsuarioDetalle> => {
  const fila = await prisma.usuario.findUnique({
    where: { id },
    include: SELECT_CATALOGOS.include,
  });

  if (!fila) {
    throw new HttpError(404, 'Usuario no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  return mapear(fila);
};

export const asignarRol = async (
  id: string,
  rolId: number | null
): Promise<UsuarioDetalle> => {
  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) {
    throw new HttpError(404, 'Usuario no encontrado', [{ campo: 'id', valor: id }]);
  }

  if (rolId !== null) {
    const rol = await prisma.rol.findFirst({
      where: { id: rolId, activo: true },
      select: { id: true },
    });
    if (!rol) {
      throw new HttpError(400, 'El rol indicado no existe o esta inactivo', [
        { campo: 'rolId', valor: rolId },
      ]);
    }
  }

  const fila = await prisma.usuario.update({
    where: { id },
    data: { rolId },
    include: SELECT_CATALOGOS.include,
  });

  return mapear(fila);
};

export const crear = async (datos: DatosCreacionUsuario): Promise<UsuarioDetalle> => {
  await verificarCatalogo('departamentoId', datos.departamentoId);
  await verificarCatalogo('ubicacionId', datos.ubicacionId);
  await verificarCatalogo('puestoId', datos.puestoId);
  await verificarCatalogo('tipoUsuarioId', datos.tipoUsuarioId);

  const passwordHash = datos.password
    ? await bcrypt.hash(datos.password, ROUNDS_BCRYPT)
    : null;

  let fila: UsuarioConCatalogos;

  try {
    fila = await prisma.usuario.create({
      data: {
        id: datos.id,
        nombre: datos.nombre,
        email: datos.email,
        passwordHash,
        departamentoId: datos.departamentoId,
        ubicacionId: datos.ubicacionId,
        puestoId: datos.puestoId,
        tipoUsuarioId: datos.tipoUsuarioId,
        fechaInicio: datos.fechaInicio,
        fechaFin: datos.fechaFin,
        activo: true,
      },
      include: SELECT_CATALOGOS.include,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new HttpError(409, 'Ya existe un usuario con ese id', [
        { campo: 'id', valor: datos.id },
      ]);
    }
    throw error;
  }

  return mapear(fila);
};

export const actualizar = async (
  id: string,
  datos: DatosEdicionUsuario
): Promise<UsuarioDetalle> => {
  const existente = await prisma.usuario.findUnique({ where: { id } });

  if (!existente) {
    throw new HttpError(404, 'Usuario no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  if (datos.departamentoId !== undefined) {
    await verificarCatalogo('departamentoId', datos.departamentoId);
  }
  if (datos.ubicacionId !== undefined) {
    await verificarCatalogo('ubicacionId', datos.ubicacionId);
  }
  if (datos.puestoId !== undefined) {
    await verificarCatalogo('puestoId', datos.puestoId);
  }
  if (datos.tipoUsuarioId !== undefined) {
    await verificarCatalogo('tipoUsuarioId', datos.tipoUsuarioId);
  }

  const fila = await prisma.usuario.update({
    where: { id },
    data: datos as Prisma.UsuarioUncheckedUpdateInput,
    include: SELECT_CATALOGOS.include,
  });

  return mapear(fila);
};

export const cambiarPassword = async (
  id: string,
  password: string
): Promise<UsuarioDetalle> => {
  const existente = await prisma.usuario.findUnique({ where: { id } });

  if (!existente) {
    throw new HttpError(404, 'Usuario no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS_BCRYPT);

  const fila = await prisma.usuario.update({
    where: { id },
    data: { passwordHash },
    include: SELECT_CATALOGOS.include,
  });

  return mapear(fila);
};

export const eliminar = async (id: string): Promise<UsuarioDetalle> => {
  const existente = await prisma.usuario.findUnique({
    where: { id },
    include: SELECT_CATALOGOS.include,
  });

  if (!existente) {
    throw new HttpError(404, 'Usuario no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  if (!existente.activo) {
    return mapear(existente);
  }

  const fila = await prisma.usuario.update({
    where: { id },
    data: { activo: false },
    include: SELECT_CATALOGOS.include,
  });

  return mapear(fila);
};
