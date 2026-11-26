import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { enviarCorreo } from '../config/mailer';
import { HttpError } from '../middlewares/error.middleware';

const ROUNDS_BCRYPT = 10;

const leerEntero = (valor: string | undefined, predeterminado: number): number => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : predeterminado;
};

const minutosExpiracion = (): number =>
  leerEntero(process.env.PASSWORD_RESET_TTL_MINUTOS, 30);

const segundosEspera = (): number =>
  leerEntero(process.env.PASSWORD_RESET_COOLDOWN_SECONDS, 60);

const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

const escaparHtml = (valor: string): string =>
  valor.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter] ?? caracter;
  });

const urlDeRecuperacion = (token: string): string => {
  const configurada = process.env.PASSWORD_RESET_URL?.trim();
  const dominio = (process.env.DOMAIN?.trim() || 'localhost')
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const base = configurada
    ? configurada.replace(/\/+$/, '')
    : `https://${dominio}/dev/recuperar`;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

export const solicitarRecuperacionPassword = async (
  email: string
): Promise<void> => {
  const correo = email.trim().toLowerCase();
  if (!correo) return;

  const usuario = await prisma.usuario.findFirst({
    where: {
      email: { equals: correo },
      activo: true,
      passwordHash: { not: null },
    },
    select: { id: true, nombre: true, email: true },
  });

  // Respuesta uniforme: no revelar si el correo existe en el sistema.
  if (!usuario?.email) return;

  const ahora = new Date();
  const desde = new Date(ahora.getTime() - segundosEspera() * 1000);
  const reciente = await prisma.passwordResetToken.findFirst({
    where: { usuarioId: usuario.id, creadoEn: { gte: desde } },
    select: { id: true },
  });
  if (reciente) return;

  const token = randomBytes(32).toString('hex');
  const minutos = minutosExpiracion();

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { usuarioId: usuario.id, usadoEn: null },
      data: { usadoEn: ahora },
    }),
    prisma.passwordResetToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashToken(token),
        expiraEn: new Date(ahora.getTime() + minutos * 60_000),
      },
    }),
  ]);

  const url = urlDeRecuperacion(token);
  try {
    await enviarCorreo({
      para: correo,
      asunto: 'Restablecimiento de contraseña - Sistema de Gestión de TI',
      texto: [
        `Hola ${usuario.nombre},`,
        '',
        'Recibimos una solicitud para restablecer tu contraseña.',
        `Abre este enlace: ${url}`,
        `El enlace expira en ${minutos} minutos. Si no fuiste tú, ignora este correo.`,
      ].join('\n'),
      html: `<p>Hola ${escaparHtml(usuario.nombre)},</p><p>Recibimos una solicitud para restablecer tu contraseña.</p><p><a href="${escaparHtml(url)}">Restablecer contraseña</a></p><p>El enlace expira en ${minutos} minutos. Si no fuiste tú, ignora este correo.</p>`,
    });
  } catch (error) {
    console.error('[AUTH] No se pudo enviar el correo de recuperación', error);
  }

  // Mientras no haya SMTP configurado, el enlace queda visible solo en desarrollo.
  if (process.env.NODE_ENV !== 'production') {
    console.info(`[AUTH] Enlace de recuperación (solo desarrollo): ${url}`);
  }
};

export const restablecerPassword = async (
  token: string,
  password: string
): Promise<void> => {
  const tokenValor = token.trim();
  if (!tokenValor) {
    throw new HttpError(400, 'El enlace de recuperación no es válido');
  }

  const ahora = new Date();
  const registro = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: hashToken(tokenValor),
      usadoEn: null,
      expiraEn: { gt: ahora },
    },
    select: {
      usuarioId: true,
      usuario: { select: { activo: true } },
    },
  });

  if (!registro?.usuario.activo) {
    throw new HttpError(400, 'El enlace de recuperación no es válido o expiró');
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS_BCRYPT);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.updateMany({
      where: { usuarioId: registro.usuarioId, usadoEn: null },
      data: { usadoEn: ahora },
    }),
  ]);
};
