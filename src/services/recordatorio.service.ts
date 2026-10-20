import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionRecordatorio,
  DatosEdicionRecordatorio,
  ParametrosListadoRecordatorios,
  RecordatorioResumen,
  ResultadoListadoRecordatorios,
} from '../models/recordatorio.model';
import { registrarAuditoria } from './auditoria.service';

const mapearRecordatorio = (
  fila: Prisma.RecordatorioGetPayload<object>
): RecordatorioResumen => ({
  id: fila.id,
  titulo: fila.titulo,
  descripcion: fila.descripcion,
  fecha: fila.fecha,
  prioridad: fila.prioridad,
  completado: fila.completado,
  completadoEn: fila.completadoEn,
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const construirFiltro = (
  parametros: ParametrosListadoRecordatorios
): Prisma.RecordatorioWhereInput => ({
  usuarioId: parametros.usuarioId,
  activo: true,
  ...(parametros.q
    ? {
        OR: [
          { titulo: { contains: parametros.q } },
          { descripcion: { contains: parametros.q } },
        ],
      }
    : {}),
  ...(parametros.completado !== undefined
    ? { completado: parametros.completado }
    : {}),
  ...(parametros.prioridad ? { prioridad: parametros.prioridad } : {}),
  ...(parametros.sinFecha
    ? { fecha: null }
    : parametros.desde || parametros.hasta
      ? {
          fecha: {
            ...(parametros.desde ? { gte: parametros.desde } : {}),
            ...(parametros.hasta ? { lte: parametros.hasta } : {}),
          },
        }
      : {}),
});

export const listarRecordatorios = async (
  parametros: ParametrosListadoRecordatorios
): Promise<ResultadoListadoRecordatorios> => {
  const where = construirFiltro(parametros);

  const [filas, total] = await Promise.all([
    prisma.recordatorio.findMany({
      where,
      orderBy: [
        { completado: 'asc' },
        { fecha: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.recordatorio.count({ where }),
  ]);

  return {
    recordatorios: filas.map(mapearRecordatorio),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerRecordatorio = async (
  usuarioId: string,
  id: number
): Promise<RecordatorioResumen> => {
  const fila = await prisma.recordatorio.findFirst({
    where: { id, usuarioId, activo: true },
  });

  if (!fila) {
    throw new HttpError(404, 'Recordatorio no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  return mapearRecordatorio(fila);
};

export const crearRecordatorio = async (
  datos: DatosCreacionRecordatorio,
  usuarioId: string
): Promise<RecordatorioResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    const creado = await tx.recordatorio.create({
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        fecha: datos.fecha,
        prioridad: datos.prioridad,
        usuarioId,
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'RECORDATORIOS',
      accion: 'CREAR',
      entidadId: creado.id,
      usuarioId,
      detalle: {
        campos: ['titulo', 'descripcion', 'fecha', 'prioridad'],
      },
    });

    return creado;
  });

  return mapearRecordatorio(fila);
};

export const actualizarRecordatorio = async (
  usuarioId: string,
  id: number,
  datos: DatosEdicionRecordatorio
): Promise<RecordatorioResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    const existente = await tx.recordatorio.findFirst({
      where: { id, usuarioId, activo: true },
      select: { id: true },
    });

    if (!existente) {
      throw new HttpError(404, 'Recordatorio no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    const actualizado = await tx.recordatorio.update({
      where: { id },
      data: {
        ...(datos.titulo !== undefined ? { titulo: datos.titulo } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion }
          : {}),
        ...(datos.fecha !== undefined ? { fecha: datos.fecha } : {}),
        ...(datos.prioridad !== undefined
          ? { prioridad: datos.prioridad }
          : {}),
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'RECORDATORIOS',
      accion: 'ACTUALIZAR',
      entidadId: id,
      usuarioId,
      detalle: { campos: Object.keys(datos) },
    });

    return actualizado;
  });

  return mapearRecordatorio(fila);
};

export const completarRecordatorio = async (
  usuarioId: string,
  id: number,
  completado: boolean
): Promise<RecordatorioResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    const existente = await tx.recordatorio.findFirst({
      where: { id, usuarioId, activo: true },
      select: { id: true, completado: true },
    });

    if (!existente) {
      throw new HttpError(404, 'Recordatorio no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    if (existente.completado === completado) {
      const actual = await tx.recordatorio.findUniqueOrThrow({ where: { id } });
      return actual;
    }

    const actualizado = await tx.recordatorio.update({
      where: { id },
      data: {
        completado,
        completadoEn: completado ? new Date() : null,
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'RECORDATORIOS',
      accion: 'ACTUALIZAR',
      entidadId: id,
      usuarioId,
      detalle: {
        campos: ['completado'],
        completado,
      },
    });

    return actualizado;
  });

  return mapearRecordatorio(fila);
};

export const desactivarRecordatorio = async (
  usuarioId: string,
  id: number
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const existente = await tx.recordatorio.findFirst({
      where: { id, usuarioId },
      select: { id: true, activo: true },
    });

    if (!existente) {
      throw new HttpError(404, 'Recordatorio no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    if (!existente.activo) return;

    await tx.recordatorio.update({
      where: { id },
      data: { activo: false },
    });

    await registrarAuditoria(tx, {
      modulo: 'RECORDATORIOS',
      accion: 'DESACTIVAR',
      entidadId: id,
      usuarioId,
      detalle: { campos: ['activo'] },
    });
  });
};
