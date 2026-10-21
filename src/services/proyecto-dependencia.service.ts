import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DependenciasTarea,
  TareaDependenciaResumen,
} from '../models/proyecto-dependencia.model';
import { registrarAuditoria } from './auditoria.service';

const SELECT_TAREA_DEPENDENCIA = {
  id: true,
  titulo: true,
  estado: true,
  parentId: true,
} as const;

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

const verificarTareaActiva = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  tareaId: number
): Promise<void> => {
  const tarea = await cliente.proyectoTarea.findFirst({
    where: { id: tareaId, proyectoId, activo: true },
    select: { id: true },
  });
  if (!tarea) {
    throw new HttpError(404, 'Tarea no encontrada', [
      { campo: 'tareaId', valor: tareaId },
    ]);
  }
};

const mapearDependencia = (fila: {
  id: number;
  titulo: string;
  estado: TareaDependenciaResumen['estado'];
  parentId: number | null;
}): TareaDependenciaResumen => ({
  id: fila.id,
  titulo: fila.titulo,
  estado: fila.estado,
  parentId: fila.parentId,
});

export const listarDependencias = async (
  proyectoId: number,
  tareaId: number
): Promise<DependenciasTarea> => {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }

  const tarea = await prisma.proyectoTarea.findFirst({
    where: { id: tareaId, proyectoId, activo: true },
    select: { id: true },
  });
  if (!tarea) {
    throw new HttpError(404, 'Tarea no encontrada', [
      { campo: 'tareaId', valor: tareaId },
    ]);
  }

  const [dependencias, dependientes] = await Promise.all([
    prisma.proyectoTareaDependencia.findMany({
      where: { tareaId },
      include: { dependeDe: { select: SELECT_TAREA_DEPENDENCIA } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.proyectoTareaDependencia.findMany({
      where: { dependeDeId: tareaId },
      include: { tarea: { select: SELECT_TAREA_DEPENDENCIA } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return {
    dependeDe: dependencias.map((fila) => mapearDependencia(fila.dependeDe)),
    dependientes: dependientes.map((fila) => mapearDependencia(fila.tarea)),
  };
};

const validarSinCiclo = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  tareaId: number,
  dependeDeId: number
): Promise<void> => {
  const aristas = await cliente.proyectoTareaDependencia.findMany({
    where: { tarea: { proyectoId } },
    select: { tareaId: true, dependeDeId: true },
  });

  const adyacencia = new Map<number, number[]>();
  for (const arista of aristas) {
    const actuales = adyacencia.get(arista.tareaId) ?? [];
    actuales.push(arista.dependeDeId);
    adyacencia.set(arista.tareaId, actuales);
  }

  const pendientes = [dependeDeId];
  const visitados = new Set<number>();

  while (pendientes.length > 0) {
    const actual = pendientes.pop() as number;
    if (actual === tareaId) {
      throw new HttpError(
        409,
        'La dependencia crearia un ciclo entre tareas',
        [{ campo: 'dependeDeId', valor: dependeDeId }]
      );
    }
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    for (const siguiente of adyacencia.get(actual) ?? []) {
      if (!visitados.has(siguiente)) pendientes.push(siguiente);
    }
  }
};

export const agregarDependencia = async (
  proyectoId: number,
  tareaId: number,
  dependeDeId: number,
  ejecutorId: string
): Promise<DependenciasTarea> => {
  await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);
    await verificarTareaActiva(tx, proyectoId, tareaId);
    await verificarTareaActiva(tx, proyectoId, dependeDeId);

    if (tareaId === dependeDeId) {
      throw new HttpError(
        400,
        'Una tarea no puede depender de si misma',
        [{ campo: 'dependeDeId', valor: dependeDeId }]
      );
    }

    const existente = await tx.proyectoTareaDependencia.findUnique({
      where: {
        tareaId_dependeDeId: { tareaId, dependeDeId },
      },
      select: { tareaId: true },
    });
    if (existente) {
      throw new HttpError(409, 'La dependencia ya existe', [
        { campo: 'dependeDeId', valor: dependeDeId },
      ]);
    }

    await validarSinCiclo(tx, proyectoId, tareaId, dependeDeId);

    await tx.proyectoTareaDependencia.create({
      data: { tareaId, dependeDeId },
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'ASIGNAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: { tareaId, dependeDeId },
    });
  });

  return listarDependencias(proyectoId, tareaId);
};

export const eliminarDependencia = async (
  proyectoId: number,
  tareaId: number,
  dependeDeId: number,
  ejecutorId: string
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);
    await verificarTareaActiva(tx, proyectoId, tareaId);

    const existente = await tx.proyectoTareaDependencia.findUnique({
      where: {
        tareaId_dependeDeId: { tareaId, dependeDeId },
      },
      select: { tareaId: true },
    });
    if (!existente) {
      throw new HttpError(404, 'Dependencia no encontrada', [
        { campo: 'dependeDeId', valor: dependeDeId },
      ]);
    }

    await tx.proyectoTareaDependencia.delete({
      where: {
        tareaId_dependeDeId: { tareaId, dependeDeId },
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'ELIMINAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: { tareaId, dependeDeId },
    });
  });
};
