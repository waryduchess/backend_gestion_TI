import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  CredencialesLogin,
  RespuestaLogin,
  UsuarioAuth,
  UsuarioPerfil,
} from '../models/auth.model';
import {
  firmarToken,
  obtenerExpiracionConfigurada,
} from '../utils/jwt';

const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales invalidas';

export const iniciarSesion = async (
  credenciales: CredencialesLogin
): Promise<RespuestaLogin> => {
  const email = credenciales.email.trim().toLowerCase();

  const usuario = await prisma.usuario.findFirst({
    where: {
      email: { equals: email },
      activo: true,
      passwordHash: { not: null },
    },
  });

  if (!usuario || !usuario.passwordHash) {
    throw new HttpError(401, MENSAJE_CREDENCIALES_INVALIDAS);
  }

  const coincide = await bcrypt.compare(
    credenciales.password,
    usuario.passwordHash
  );

  if (!coincide) {
    throw new HttpError(401, MENSAJE_CREDENCIALES_INVALIDAS);
  }

  const usuarioAuth: UsuarioAuth = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
  };

  return {
    token: firmarToken(usuarioAuth),
    tokenTipo: 'Bearer',
    expiraEn: obtenerExpiracionConfigurada(),
    usuario: usuarioAuth,
  };
};

export const obtenerPerfil = async (id: string): Promise<UsuarioPerfil> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      email: true,
      activo: true,
      rol: { select: { nombre: true } },
    },
  });

  if (!usuario) {
    throw new HttpError(401, 'La sesion ya no es valida');
  }

  if (!usuario.activo) {
    throw new HttpError(403, 'El usuario esta inactivo');
  }

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    activo: usuario.activo,
    rol: usuario.rol?.nombre ?? null,
  };
};
