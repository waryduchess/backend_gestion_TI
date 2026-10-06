import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  AuditoriaSecretoResumen,
  DatosCreacionSecreto,
  DatosEdicionSecreto,
  MetadatosListadoSecretos,
  ParametrosListadoAuditoria,
  ParametrosListadoSecretos,
  SecretoResumen,
} from '../models/secreto.model';
import { cifrar, descifrar } from '../utils/crypto';

const SELECCIONAR_SECRETO = {
  id: true,
  tipo: true,
  proyecto: true,
  nombre: true,
  usuario: true,
  comentario: true,
  activo: true,
} as const;

const SELECCIONAR_AUDITORIA = {
  id: true,
  secretoId: true,
  accion: true,
  campos: true,
  realizadaEn: true,
  usuario: {
    select: {
      id: true,
      nombre: true,
    },
  },
} as const;

type FilaSecreto = Prisma.SecretoGetPayload<{
  select: typeof SELECCIONAR_SECRETO;
}>;
type FilaAuditoriaSecreto = Prisma.AuditoriaSecretoGetPayload<{
  select: typeof SELECCIONAR_AUDITORIA;
}>;

const mapearSecreto = (fila: FilaSecreto): SecretoResumen => ({
  id: fila.id,
  tipo: fila.tipo,
  proyecto: fila.proyecto,
  nombre: fila.nombre,
  usuario: fila.usuario,
  comentario: fila.comentario,
  activo: fila.activo,
});

const mapearAuditoria = (
  fila: FilaAuditoriaSecreto
): AuditoriaSecretoResumen => ({
  id: fila.id,
  secretoId: fila.secretoId,
  accion: fila.accion,
  campos:
    Array.isArray(fila.campos) &&
    fila.campos.every((campo): campo is string => typeof campo === 'string')
      ? fila.campos
      : null,
  realizadaEn: fila.realizadaEn,
  usuario: fila.usuario,
});

const obtenerSecreto = async (
  id: number,
  soloActivo: boolean
): Promise<FilaSecreto> => {
  const fila = await prisma.secreto.findFirst({
    where: { id, ...(soloActivo ? { activo: true } : {}) },
    select: SELECCIONAR_SECRETO,
  });
  if (!fila) {
    throw new HttpError(404, 'Secreto no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  return fila;
};

export interface ResultadoListadoSecretos {
  secretos: SecretoResumen[];
  meta: MetadatosListadoSecretos;
}

export const listarSecretos = async (
  parametros: ParametrosListadoSecretos
): Promise<ResultadoListadoSecretos> => {
  const where: Prisma.SecretoWhereInput = {
    ...(parametros.activo !== undefined
      ? { activo: parametros.activo }
      : {}),
    ...(parametros.tipo ? { tipo: { contains: parametros.tipo } } : {}),
    ...(parametros.proyecto
      ? { proyecto: { contains: parametros.proyecto } }
      : {}),
    ...(parametros.q
      ? {
          OR: [
            { tipo: { contains: parametros.q } },
            { proyecto: { contains: parametros.q } },
            { nombre: { contains: parametros.q } },
            { usuario: { contains: parametros.q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.secreto.findMany({
      where,
      select: SELECCIONAR_SECRETO,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.secreto.count({ where }),
  ]);

  return {
    secretos: filas.map(mapearSecreto),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerSecretoResumen = async (
  id: number
): Promise<SecretoResumen> => mapearSecreto(await obtenerSecreto(id, false));

export const crearSecreto = async (
  usuarioId: string,
  datos: DatosCreacionSecreto
): Promise<SecretoResumen> =>
  prisma.$transaction(async (tx) => {
    const fila = await tx.secreto.create({
      data: {
        tipo: datos.tipo,
        proyecto: datos.proyecto,
        nombre: datos.nombre,
        usuario: datos.usuario,
        password: cifrar(datos.password),
        comentario: datos.comentario,
      },
      select: SELECCIONAR_SECRETO,
    });
    await tx.auditoriaSecreto.create({
      data: {
        secretoId: fila.id,
        usuarioId,
        accion: 'CREAR',
        campos: ['tipo', 'proyecto', 'nombre', 'usuario', 'password', 'comentario'],
      },
    });
    return mapearSecreto(fila);
  });

export const actualizarSecreto = async (
  usuarioId: string,
  id: number,
  datos: DatosEdicionSecreto
): Promise<SecretoResumen> =>
  prisma.$transaction(async (tx) => {
    const existente = await tx.secreto.findUnique({
      where: { id },
      select: { activo: true },
    });
    if (!existente || (!existente.activo && datos.activo !== true)) {
      throw new HttpError(404, 'Secreto no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    const campos = Object.keys(datos);
    const fila = await tx.secreto.update({
      where: { id },
      data: {
        ...(datos.tipo !== undefined ? { tipo: datos.tipo } : {}),
        ...(datos.proyecto !== undefined ? { proyecto: datos.proyecto } : {}),
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.usuario !== undefined ? { usuario: datos.usuario } : {}),
        ...(datos.password !== undefined
          ? { password: cifrar(datos.password) }
          : {}),
        ...(datos.comentario !== undefined
          ? { comentario: datos.comentario }
          : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      },
      select: SELECCIONAR_SECRETO,
    });
    if (campos.length > 0) {
      await tx.auditoriaSecreto.create({
        data: {
          secretoId: id,
          usuarioId,
          accion: 'ACTUALIZAR',
          campos,
        },
      });
    }
    return mapearSecreto(fila);
  });

export const desactivarSecreto = async (
  usuarioId: string,
  id: number
): Promise<SecretoResumen> =>
  prisma.$transaction(async (tx) => {
    const existente = await tx.secreto.findUnique({
      where: { id },
      select: { activo: true },
    });
    if (!existente) {
      throw new HttpError(404, 'Secreto no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }
    if (!existente.activo) {
      return mapearSecreto(await tx.secreto.findUniqueOrThrow({
        where: { id },
        select: SELECCIONAR_SECRETO,
      }));
    }

    const fila = await tx.secreto.update({
      where: { id },
      data: { activo: false },
      select: SELECCIONAR_SECRETO,
    });
    await tx.auditoriaSecreto.create({
      data: {
        secretoId: id,
        usuarioId,
        accion: 'DESACTIVAR',
        campos: ['activo'],
      },
    });
    return mapearSecreto(fila);
  });

export const revelarPasswordSecreto = async (
  usuarioId: string,
  id: number
): Promise<{ id: number; password: string }> =>
  prisma.$transaction(async (tx) => {
    const fila = await tx.secreto.findFirst({
      where: { id, activo: true },
      select: { id: true, password: true },
    });
    if (!fila) {
      throw new HttpError(404, 'Secreto no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }
    const password = descifrar(fila.password);
    await tx.auditoriaSecreto.create({
      data: {
        secretoId: id,
        usuarioId,
        accion: 'REVELAR',
      },
    });
    return { id, password };
  });

export const listarAuditoriaSecreto = async (
  parametros: ParametrosListadoAuditoria
): Promise<{
  auditoria: AuditoriaSecretoResumen[];
  meta: MetadatosListadoSecretos;
}> => {
  await obtenerSecreto(parametros.secretoId, false);
  const where = { secretoId: parametros.secretoId };
  const [filas, total] = await Promise.all([
    prisma.auditoriaSecreto.findMany({
      where,
      select: SELECCIONAR_AUDITORIA,
      orderBy: [{ realizadaEn: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.auditoriaSecreto.count({ where }),
  ]);
  return {
    auditoria: filas.map(mapearAuditoria),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};
