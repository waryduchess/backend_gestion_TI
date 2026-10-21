import { EstadoHito, Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionHito,
  DatosEdicionHito,
  HitoProyectoResumen,
} from '../models/proyecto-hito.model';
import { registrarAuditoria } from './auditoria.service';

const mapearHito = (fila: {
  id: number;
  proyectoId: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoHito;
  fechaPlanificada: Date;
  fechaCompletada: Date | null;
  orden: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}): HitoProyectoResumen => ({
  id: fila.id,
  proyectoId: fila.proyectoId,
  titulo: fila.titulo,
  descripcion: fila.descripcion,
  estado: fila.estado,
  fechaPlanificada: fila.fechaPlanificada,
  fechaCompletada: fila.fechaCompletada,
  orden: fila.orden,
  activo: fila.activo,
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const verificarProyectoActivo = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number
): Promise<void> => {
  const proyecto = await cliente.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }
};

const verificarProyectoParaLectura = async (
  proyectoId: number
): Promise<void> => {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }
};

const validarFechaCompletada = (
  estado: EstadoHito,
  fechaCompletada: Date | null
): void => {
  if (fechaCompletada !== null && estado !== EstadoHito.COMPLETADO) {
    throw new HttpError(
      400,
      '"fechaCompletada" solo se permite cuando el estado es COMPLETADO',
      [{ campo: 'fechaCompletada', valor: fechaCompletada.toISOString() }]
    );
  }
};

export const listarHitos = async (
  proyectoId: number
): Promise<HitoProyectoResumen[]> => {
  await verificarProyectoParaLectura(proyectoId);

  const filas = await prisma.proyectoHito.findMany({
    where: { proyectoId, activo: true },
    orderBy: [
      { fechaPlanificada: 'asc' },
      { orden: 'asc' },
      { id: 'asc' },
    ],
  });
  return filas.map(mapearHito);
};

export const obtenerHito = async (
  proyectoId: number,
  hitoId: number
): Promise<HitoProyectoResumen> => {
  await verificarProyectoParaLectura(proyectoId);

  const fila = await prisma.proyectoHito.findFirst({
    where: { id: hitoId, proyectoId, activo: true },
  });
  if (!fila) {
    throw new HttpError(404, 'Hito no encontrado', [
      { campo: 'hitoId', valor: hitoId },
    ]);
  }
  return mapearHito(fila);
};

export const crearHito = async (
  proyectoId: number,
  datos: DatosCreacionHito,
  ejecutorId: string
): Promise<HitoProyectoResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    let fechaCompletada = datos.fechaCompletada;
    if (datos.estado === EstadoHito.COMPLETADO && fechaCompletada === null) {
      fechaCompletada = new Date();
    }
    validarFechaCompletada(datos.estado, fechaCompletada);

    const creado = await tx.proyectoHito.create({
      data: {
        proyectoId,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        estado: datos.estado,
        fechaPlanificada: datos.fechaPlanificada,
        fechaCompletada,
        orden: datos.orden,
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'CREAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        hitoId: creado.id,
        campos: [
          'titulo',
          'descripcion',
          'estado',
          'fechaPlanificada',
          'fechaCompletada',
          'orden',
        ],
      },
    });

    return creado;
  });

  return mapearHito(fila);
};

export const actualizarHito = async (
  proyectoId: number,
  hitoId: number,
  datos: DatosEdicionHito,
  ejecutorId: string
): Promise<HitoProyectoResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const existente = await tx.proyectoHito.findFirst({
      where: { id: hitoId, proyectoId, activo: true },
    });
    if (!existente) {
      throw new HttpError(404, 'Hito no encontrado', [
        { campo: 'hitoId', valor: hitoId },
      ]);
    }

    const estadoFinal = datos.estado ?? existente.estado;
    let fechaCompletada =
      datos.fechaCompletada !== undefined
        ? datos.fechaCompletada
        : existente.fechaCompletada;

    if (estadoFinal === EstadoHito.COMPLETADO && fechaCompletada === null) {
      fechaCompletada = new Date();
    }
    if (estadoFinal !== EstadoHito.COMPLETADO) {
      fechaCompletada = null;
    }
    validarFechaCompletada(estadoFinal, fechaCompletada);

    const actualizado = await tx.proyectoHito.update({
      where: { id: hitoId },
      data: {
        ...(datos.titulo !== undefined ? { titulo: datos.titulo } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion }
          : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        ...(datos.fechaPlanificada !== undefined
          ? { fechaPlanificada: datos.fechaPlanificada }
          : {}),
        fechaCompletada,
        ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      },
    });

    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await registrarAuditoria(tx, {
        modulo: 'PROYECTOS',
        accion: 'ACTUALIZAR',
        entidadId: proyectoId,
        usuarioId: ejecutorId,
        detalle: { hitoId, campos },
      });
    }

    return actualizado;
  });

  return mapearHito(fila);
};

export const desactivarHito = async (
  proyectoId: number,
  hitoId: number,
  ejecutorId: string
): Promise<HitoProyectoResumen> => {
  const existente = await prisma.proyectoHito.findFirst({
    where: { id: hitoId, proyectoId },
  });
  if (!existente) {
    throw new HttpError(404, 'Hito no encontrado', [
      { campo: 'hitoId', valor: hitoId },
    ]);
  }
  if (!existente.activo) return mapearHito(existente);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const actualizado = await tx.proyectoHito.update({
      where: { id: hitoId },
      data: { activo: false },
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'DESACTIVAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: { hitoId, campos: ['activo'] },
    });

    return actualizado;
  });

  return mapearHito(fila);
};
