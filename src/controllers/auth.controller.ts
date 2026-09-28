import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { iniciarSesion, obtenerPerfil } from '../services/auth.service';
import { CredencialesLogin, RespuestaLogin, UsuarioPerfil } from '../models/auth.model';

const comoTexto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

const leerCuerpo = (req: Request): CredencialesLogin => {
  const cuerpo = (req.body ?? {}) as Record<string, unknown>;

  return {
    email: comoTexto(cuerpo.email),
    password: comoTexto(cuerpo.password),
  };
};

export const login = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const credenciales = leerCuerpo(req);
    const errores: unknown[] = [];

    if (credenciales.email === '') {
      errores.push({ campo: 'email', valor: '', mensaje: 'El email es obligatorio' });
    }

    if (credenciales.password === '') {
      errores.push({ campo: 'password', valor: '', mensaje: 'La password es obligatoria' });
    }

    if (errores.length > 0) {
      throw new HttpError(400, 'Faltan campos obligatorios', errores);
    }

    const resultado: RespuestaLogin = await iniciarSesion(credenciales);

    res.status(200).json({
      success: true,
      message: 'Sesion iniciada correctamente',
      errors: [],
      data: resultado,
    });
  }
);

export const obtenerPerfilPropio = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const usuario = req.usuario;

    if (!usuario) {
      throw new HttpError(401, 'Autenticacion requerida');
    }

    const perfil: UsuarioPerfil = await obtenerPerfil(usuario.id);

    res.status(200).json({
      success: true,
      message: 'Perfil obtenido correctamente',
      errors: [],
      data: perfil,
    });
  }
);
