import {
  EstadoHito,
  EstadoProyecto,
  EstadoTarea,
  Prisma,
} from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import {
  ProyectoPorEstado,
  ProyectoPorPrioridad,
  ResumenProyectosDashboard,
} from '../models/dashboard-proyecto.model';
import {
  filtroProyectosVisibles,
  puedeVerTodosProyectos,
} from '../utils/proyecto-visibilidad';

const ESTADOS_FINALES = [
  EstadoProyecto.COMPLETADO,
  EstadoProyecto.CANCELADO,
];

export const obtenerResumenProyectos = async (
  usuarioId: string
): Promise<ResumenProyectosDashboard> => {
  const verTodos = await puedeVerTodosProyectos(usuarioId);
  const proyectoWhere: Prisma.ProyectoWhereInput = {
    activo: true,
    ...filtroProyectosVisibles(usuarioId, verTodos),
  };

  const ahora = new Date();
  const en7Dias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    proyectosActivos,
    proyectosEnProgreso,
    proyectosVencidos,
    proyectosProximos7Dias,
    proyectosProximos30Dias,
    tareasPendientes,
    tareasVencidas,
    hitosProximos30Dias,
    hitosVencidos,
    horas,
    agrupadoEstado,
    agrupadoPrioridad,
    proyectosProximos,
  ] = await Promise.all([
    prisma.proyecto.count({ where: proyectoWhere }),
    prisma.proyecto.count({
      where: { ...proyectoWhere, estado: EstadoProyecto.EN_PROGRESO },
    }),
    prisma.proyecto.count({
      where: {
        ...proyectoWhere,
        estado: { notIn: ESTADOS_FINALES },
        fechaFinPlanificada: { lt: ahora },
      },
    }),
    prisma.proyecto.count({
      where: {
        ...proyectoWhere,
        estado: { notIn: ESTADOS_FINALES },
        fechaFinPlanificada: { gte: ahora, lte: en7Dias },
      },
    }),
    prisma.proyecto.count({
      where: {
        ...proyectoWhere,
        estado: { notIn: ESTADOS_FINALES },
        fechaFinPlanificada: { gte: ahora, lte: en30Dias },
      },
    }),
    prisma.proyectoTarea.count({
      where: {
        activo: true,
        proyecto: proyectoWhere,
        estado: { in: [EstadoTarea.PENDIENTE, EstadoTarea.EN_PROGRESO] },
      },
    }),
    prisma.proyectoTarea.count({
      where: {
        activo: true,
        proyecto: proyectoWhere,
        estado: { notIn: [EstadoTarea.COMPLETADA, EstadoTarea.CANCELADA] },
        fechaVencimiento: { lt: ahora },
      },
    }),
    prisma.proyectoHito.count({
      where: {
        activo: true,
        proyecto: proyectoWhere,
        estado: EstadoHito.PENDIENTE,
        fechaPlanificada: { gte: ahora, lte: en30Dias },
      },
    }),
    prisma.proyectoHito.count({
      where: {
        activo: true,
        proyecto: proyectoWhere,
        estado: EstadoHito.PENDIENTE,
        fechaPlanificada: { lt: ahora },
      },
    }),
    prisma.proyectoRegistroHoras.aggregate({
      where: { activo: true, proyecto: proyectoWhere },
      _sum: { horas: true },
    }),
    prisma.proyecto.groupBy({
      by: ['estado'],
      where: proyectoWhere,
      _count: { _all: true },
    }),
    prisma.proyecto.groupBy({
      by: ['prioridad'],
      where: proyectoWhere,
      _count: { _all: true },
    }),
    prisma.proyecto.findMany({
      where: {
        ...proyectoWhere,
        estado: { notIn: ESTADOS_FINALES },
        fechaFinPlanificada: { gte: ahora, lte: en30Dias },
      },
      orderBy: [{ fechaFinPlanificada: 'asc' }, { id: 'asc' }],
      take: 5,
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        prioridad: true,
        fechaFinPlanificada: true,
      },
    }),
  ]);

  const proyectosPorEstado: ProyectoPorEstado[] = agrupadoEstado
    .map((fila) => ({ estado: fila.estado, total: fila._count._all }))
    .sort((a, b) => b.total - a.total);

  const proyectosPorPrioridad: ProyectoPorPrioridad[] = agrupadoPrioridad
    .map((fila) => ({ prioridad: fila.prioridad, total: fila._count._all }))
    .sort((a, b) => b.total - a.total);

  return {
    kpis: {
      proyectosActivos,
      proyectosEnProgreso,
      proyectosVencidos,
      proyectosProximos7Dias,
      proyectosProximos30Dias,
      tareasPendientes,
      tareasVencidas,
      hitosProximos30Dias,
      hitosVencidos,
      horasRegistradas:
        horas._sum.horas === null ? 0 : Number(horas._sum.horas),
    },
    proyectosPorEstado,
    proyectosPorPrioridad,
    proyectosProximos,
  };
};
