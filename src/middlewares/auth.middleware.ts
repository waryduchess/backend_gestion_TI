import { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { HttpError } from './error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { PERMISOS_DISPONIBLES, Permiso } from '../models/rol.model';
import { TokenPayload, verificarToken as verificarJwt } from '../utils/jwt';

export const verificarToken = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const cabecera = req.headers.authorization;

  if (typeof cabecera !== 'string' || !cabecera.startsWith('Bearer ')) {
    next(new HttpError(401, 'Token de acceso no proporcionado'));
    return;
  }

  try {
    const payload: TokenPayload = verificarJwt(cabecera.slice(7).trim());

    if (!payload.sub || !payload.nombre) {
      throw new Error('El token no contiene los claims obligatorios');
    }

    req.usuario = {
      id: payload.sub,
      nombre: payload.nombre,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
    next();
  } catch {
    next(new HttpError(401, 'Token de acceso invalido o expirado'));
  }
};

export const verificarPermiso = (...permisosRequeridos: Permiso[]) =>
  asyncHandler(
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      const usuarioAutenticado = req.usuario;
      if (!usuarioAutenticado) {
        throw new HttpError(401, 'Autenticacion requerida');
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: usuarioAutenticado.id },
        select: {
          activo: true,
          rol: {
            select: {
              activo: true,
              permisos: true,
            },
          },
        },
      });

      if (!usuario || !usuario.activo) {
        throw new HttpError(403, 'El usuario esta inactivo o ya no existe');
      }
      if (!usuario.rol || !usuario.rol.activo) {
        throw new HttpError(403, 'El usuario no tiene un rol activo');
      }

      if (
        !Array.isArray(usuario.rol.permisos) ||
        !usuario.rol.permisos.every(
          (permiso): boolean =>
            typeof permiso === 'string' &&
            PERMISOS_DISPONIBLES.includes(permiso as Permiso)
        )
      ) {
        throw new Error(
          `El rol del usuario ${usuarioAutenticado.id} tiene permisos invalidos`
        );
      }

      const permisosUsuario = usuario.rol.permisos;
      const faltantes = permisosRequeridos.filter(
        (permiso) => !permisosUsuario.includes(permiso)
      );
      if (faltantes.length > 0) {
        throw new HttpError(403, 'No tienes permisos para realizar esta operacion', [
          { campo: 'permisos', requeridos: permisosRequeridos, faltantes },
        ]);
      }

      next();
    }
  );
