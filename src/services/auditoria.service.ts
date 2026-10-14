import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  AuditoriaResumen,
  DatosRegistroAuditoria,
  MetadatosListadoAuditoria,
  ParametrosListadoAuditoriaGlobal,
} from '../models/auditoria.model';

const SELECCIONAR_AUDITORIA = {
  id: true,
  modulo: true,
  accion: true,
  entidadId: true,
  detalle: true,
  realizadaEn: true,
  usuario: {
    select: {
      id: true,
      nombre: true,
    },
  },
} as const;

type FilaAuditoria = Prisma.AuditoriaGetPayload<{
  select: typeof SELECCIONAR_AUDITORIA;
}>;

const mapearAuditoria = (fila: FilaAuditoria): AuditoriaResumen => ({
  id: fila.id,
  modulo: fila.modulo,
  accion: fila.accion,
  entidadId: fila.entidadId,
  detalle: fila.detalle,
  realizadaEn: fila.realizadaEn,
  usuario: fila.usuario,
});

export const registrarAuditoria = async (
  tx: Prisma.TransactionClient,
  datos: DatosRegistroAuditoria
): Promise<void> => {
  await tx.auditoria.create({
    data: {
      modulo: datos.modulo,
      accion: datos.accion,
      entidadId:
        datos.entidadId === null || datos.entidadId === undefined
          ? null
          : String(datos.entidadId),
      usuarioId: datos.usuarioId,
      ...(datos.detalle === undefined || datos.detalle === null
        ? {}
        : { detalle: datos.detalle }),
    },
  });
};

export interface ResultadoListadoAuditoria {
  auditoria: AuditoriaResumen[];
  meta: MetadatosListadoAuditoria;
}

export const listarAuditoria = async (
  parametros: ParametrosListadoAuditoriaGlobal
): Promise<ResultadoListadoAuditoria> => {
  const where: Prisma.AuditoriaWhereInput = {
    ...(parametros.modulo ? { modulo: parametros.modulo } : {}),
    ...(parametros.accion ? { accion: parametros.accion } : {}),
    ...(parametros.usuarioId ? { usuarioId: parametros.usuarioId } : {}),
    ...(parametros.entidadId ? { entidadId: parametros.entidadId } : {}),
    ...(parametros.desde || parametros.hasta
      ? {
          realizadaEn: {
            ...(parametros.desde ? { gte: parametros.desde } : {}),
            ...(parametros.hasta ? { lte: parametros.hasta } : {}),
          },
        }
      : {}),
    ...(parametros.q
      ? {
          OR: [
            { modulo: { contains: parametros.q } },
            { accion: { contains: parametros.q } },
            { entidadId: { contains: parametros.q } },
            { usuario: { nombre: { contains: parametros.q } } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      select: SELECCIONAR_AUDITORIA,
      orderBy: [{ realizadaEn: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.auditoria.count({ where }),
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

export const obtenerAuditoria = async (id: number): Promise<AuditoriaResumen> => {
  const fila = await prisma.auditoria.findUnique({
    where: { id },
    select: SELECCIONAR_AUDITORIA,
  });
  if (!fila) {
    throw new HttpError(404, 'Registro de auditoria no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  return mapearAuditoria(fila);
};
