import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import {
  calcularPermisosEfectivos,
  normalizarPermisos,
} from './permisos';

export const puedeVerTodosProyectos = async (
  usuarioId: string
): Promise<boolean> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      permisosExtra: true,
      permisosRevocados: true,
      rol: {
        select: { activo: true, permisos: true },
      },
    },
  });

  if (!usuario?.rol?.activo) return false;

  try {
    const permisos = calcularPermisosEfectivos(
      normalizarPermisos(
        usuario.rol.permisos,
        'Rol del usuario para visibilidad de proyectos'
      ),
      normalizarPermisos(
        usuario.permisosExtra,
        'permisosExtra para visibilidad de proyectos'
      ),
      normalizarPermisos(
        usuario.permisosRevocados,
        'permisosRevocados para visibilidad de proyectos'
      )
    );
    return permisos.includes('proyectos:ver-todos');
  } catch {
    return false;
  }
};

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
