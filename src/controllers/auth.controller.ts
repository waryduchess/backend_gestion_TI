import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { iniciarSesion, obtenerPerfil } from '../services/auth.service';
import {
  restablecerPassword,
  solicitarRecuperacionPassword,
} from '../services/recuperacion-password.service';
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

export const solicitarRecuperacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const email = comoTexto(cuerpo.email);

    if (!email) {
      throw new HttpError(400, 'El correo es obligatorio', [
        { campo: 'email', valor: '', mensaje: 'El correo es obligatorio' },
      ]);
    }

    await solicitarRecuperacionPassword(email);

    res.status(202).json({
      success: true,
      message:
        'Si existe una cuenta con ese correo, recibirá las instrucciones para restablecer su contraseña',
      errors: [],
      data: null,
    });
  }
);

export const confirmarRestablecimiento = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const token = comoTexto(cuerpo.token);
    const password = comoTexto(cuerpo.password);
    const errores: unknown[] = [];

    if (!token) {
      errores.push({
        campo: 'token',
        valor: '',
        mensaje: 'El enlace de recuperación es obligatorio',
      });
    }

    if (password.length < 8) {
      errores.push({
        campo: 'password',
        valor: '',
        mensaje: 'La contraseña debe tener al menos 8 caracteres',
      });
    }

    if (errores.length > 0) {
      throw new HttpError(400, 'Datos de recuperación inválidos', errores);
    }

    await restablecerPassword(token, password);

    res.status(200).json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      errors: [],
      data: null,
    });
  }
);
