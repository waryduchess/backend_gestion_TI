import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import { ArchivoImagen, ResultadoListadoAdjuntos, DescargaAdjunto, AdjuntoResumen } from '../models/adjunto.model';
import {
  crearAdjunto,
  eliminarAdjunto,
  generarUrlDescarga,
  listarAdjuntos,
} from './adjunto.service';

const verificarEvidenciaDeOrden = async (
  mantenimientoId: number,
  adjuntoId: number
): Promise<void> => {
  const evidencia = await prisma.adjunto.findFirst({
    where: {
      id: adjuntoId,
      entidadTipo: 'MANTENIMIENTO',
      entidadId: String(mantenimientoId),
    },
    select: { id: true },
  });

  if (!evidencia) {
    throw new HttpError(404, 'Evidencia de mantenimiento no encontrada', [
      { campo: 'adjuntoId', valor: adjuntoId },
    ]);
  }
};

export const listarEvidenciasMantenimiento = async (
  mantenimientoId: number,
  usuarioId: string,
  page: number,
  limit: number
): Promise<ResultadoListadoAdjuntos> =>
  listarAdjuntos(
    {
      page,
      limit,
      entidadTipo: 'MANTENIMIENTO',
      entidadId: String(mantenimientoId),
    },
    usuarioId
  );

export const crearEvidenciaMantenimiento = async (
  mantenimientoId: number,
  usuarioId: string,
  archivo: ArchivoImagen
): Promise<AdjuntoResumen> =>
  crearAdjunto(usuarioId, {
    entidadTipo: 'MANTENIMIENTO',
    entidadId: String(mantenimientoId),
    archivo,
  });

export const descargarEvidenciaMantenimiento = async (
  mantenimientoId: number,
  adjuntoId: number,
  usuarioId: string
): Promise<DescargaAdjunto> => {
  await verificarEvidenciaDeOrden(mantenimientoId, adjuntoId);
  return generarUrlDescarga(adjuntoId, usuarioId);
};

export const eliminarEvidenciaMantenimiento = async (
  mantenimientoId: number,
  adjuntoId: number,
  usuarioId: string
): Promise<void> => {
  await verificarEvidenciaDeOrden(mantenimientoId, adjuntoId);
  await eliminarAdjunto(adjuntoId, usuarioId);
};
