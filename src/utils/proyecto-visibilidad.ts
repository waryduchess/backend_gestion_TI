import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { usuarioTienePermiso } from './permisos-usuario';

export const puedeVerTodosProyectos = async (
  usuarioId: string
): Promise<boolean> =>
  usuarioTienePermiso(usuarioId, 'proyectos:ver-todos');

export const filtroProyectosVisibles = (
  usuarioId: string,
  verTodos: boolean
): Prisma.ProyectoWhereInput =>
  verTodos
    ? {}
    : {
        OR: [
          { responsableId: usuarioId },
          { miembros: { some: { usuarioId } } },
        ],
      };

export const tieneAccesoProyecto = async (
  proyectoId: number,
  usuarioId: string,
  verTodos: boolean
): Promise<boolean> => {
  const proyecto = await prisma.proyecto.findFirst({
    where: {
      id: proyectoId,
      ...filtroProyectosVisibles(usuarioId, verTodos),
    },
    select: { id: true },
  });
  return proyecto !== null;
};
