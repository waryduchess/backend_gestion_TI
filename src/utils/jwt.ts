import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { UsuarioAuth } from '../models/auth.model';

export interface TokenPayload extends JwtPayload {
  sub: string;
  nombre: string;
  email: string | null;
}

const obtenerSecreto = (): string => {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.trim() === '') {
    throw new Error('Falta la variable de entorno JWT_SECRET');
  }
  return secreto;
};

const obtenerExpiracion = (): SignOptions['expiresIn'] => {
  const expiracion = process.env.JWT_EXPIRES_IN ?? '8h';
  return expiracion as SignOptions['expiresIn'];
};

export const firmarToken = (usuario: UsuarioAuth): string => {
  const opciones: SignOptions = {
    subject: usuario.id,
    expiresIn: obtenerExpiracion(),
  };

  return jwt.sign(
    {
      nombre: usuario.nombre,
      email: usuario.email,
    },
    obtenerSecreto(),
    opciones
  );
};

export const verificarToken = (token: string): TokenPayload => {
  const decodificado = jwt.verify(token, obtenerSecreto());

  if (typeof decodificado === 'string') {
    throw new Error('El token no contiene un payload valido');
  }

  return decodificado as TokenPayload;
};

export const obtenerExpiracionConfigurada = (): string =>
  process.env.JWT_EXPIRES_IN ?? '8h';
