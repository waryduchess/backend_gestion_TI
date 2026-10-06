import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  NotificacionLista,
  ParametrosListadoNotificaciones,
  ResultadoListadoNotificaciones,
} from '../models/notificacion.model';

const INCLUIR_INCIDENCIA = {
  incidencia: {
    select: {
      id: true,
      titulo: true,
      estado: true,
      prioridad: true,
      fechaNotificacion: true,
    },
  },
} as const;

type NotificacionConIncidencia = Prisma.NotificacionGetPayload<{
  include: typeof INCLUIR_INCIDENCIA;
}>;

const mapearNotificacion = (
  fila: NotificacionConIncidencia
): NotificacionLista => ({
  id: fila.id,
  incidenciaId: fila.incidenciaId,
  creadaEn: fila.creadaEn,
  leidaEn: fila.leidaEn,
  leida: fila.leidaEn !== null,
  incidencia: fila.incidencia,
});

export const listarNotificaciones = async (
  parametros: ParametrosListadoNotificaciones
): Promise<ResultadoListadoNotificaciones> => {
  const where: Prisma.NotificacionWhereInput = {
    usuarioId: parametros.usuarioId,
    ...(parametros.leida !== undefined
      ? { leidaEn: parametros.leida ? { not: null } : null }
      : {}),
  };
  const whereNoLeidas: Prisma.NotificacionWhereInput = {
    usuarioId: parametros.usuarioId,
    leidaEn: null,
  };

  const [filas, total, noLeidas] = await Promise.all([
    prisma.notificacion.findMany({
      where,
      include: INCLUIR_INCIDENCIA,
      orderBy: [{ creadaEn: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.notificacion.count({ where }),
    prisma.notificacion.count({ where: whereNoLeidas }),
  ]);

  return {
    notificaciones: filas.map(mapearNotificacion),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parametros.limit)),
      noLeidas,
    },
  };
};

export const marcarNotificacionLeida = async (
  usuarioId: string,
  id: number
): Promise<NotificacionLista> => {
  const existente = await prisma.notificacion.findFirst({
    where: { id, usuarioId },
    select: { id: true, leidaEn: true },
  });

  if (!existente) {
    throw new HttpError(404, 'Notificacion no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  if (existente.leidaEn === null) {
    await prisma.notificacion.updateMany({
      where: { id, usuarioId, leidaEn: null },
      data: { leidaEn: new Date() },
    });
  }

  const fila = await prisma.notificacion.findFirst({
    where: { id, usuarioId },
    include: INCLUIR_INCIDENCIA,
  });
  if (!fila) {
    throw new HttpError(404, 'Notificacion no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  return mapearNotificacion(fila);
};

export const marcarTodasLeidas = async (usuarioId: string): Promise<number> => {
  const resultado = await prisma.notificacion.updateMany({
    where: { usuarioId, leidaEn: null },
    data: { leidaEn: new Date() },
  });
  return resultado.count;
};
