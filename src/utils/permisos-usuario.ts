import { prisma } from '../config/prisma';
import { Permiso } from '../models/rol.model';
import {
  calcularPermisosEfectivos,
  normalizarPermisos,
} from './permisos';

export const obtenerPermisosEfectivosUsuario = async (
  usuarioId: string
): Promise<Permiso[]> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      activo: true,
      permisosExtra: true,
      permisosRevocados: true,
      rol: {
        select: { activo: true, permisos: true },
      },
    },
  });

  if (!usuario?.activo || !usuario.rol?.activo) return [];

  try {
    return calcularPermisosEfectivos(
      normalizarPermisos(
        usuario.rol.permisos,
        'Rol del usuario para permisos efectivos'
      ),
      normalizarPermisos(
        usuario.permisosExtra,
        'permisosExtra para permisos efectivos'
      ),
      normalizarPermisos(
        usuario.permisosRevocados,
        'permisosRevocados para permisos efectivos'
      )
    );
  } catch {
    return [];
  }
};

export const usuarioTienePermiso = async (
  usuarioId: string,
  permiso: Permiso
): Promise<boolean> =>
  (await obtenerPermisosEfectivosUsuario(usuarioId)).includes(permiso);
