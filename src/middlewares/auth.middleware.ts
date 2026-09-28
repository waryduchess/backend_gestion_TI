import { NextFunction, Request, Response } from 'express';
import { HttpError } from './error.middleware';
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
