import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';

const ID_ADMIN = 'ADMIN';
const ROUNDS_BCRYPT = 10;

const main = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NAME ?? 'Administrador';

  if (!email || email.trim() === '') {
    throw new Error('Falta la variable de entorno ADMIN_EMAIL');
  }

  if (!password || password.trim() === '') {
    throw new Error('Falta la variable de entorno ADMIN_PASSWORD');
  }

  const passwordHash = await bcrypt.hash(password, ROUNDS_BCRYPT);

  const usuario = await prisma.usuario.upsert({
    where: { id: ID_ADMIN },
    update: { nombre, email, activo: true, passwordHash },
    create: { id: ID_ADMIN, nombre, email, activo: true, passwordHash },
  });

  console.log(`Admin actualizado: ${usuario.id} <${usuario.email}>`);
};

main()
  .catch((error: unknown) => {
    console.error('[seedAdmin] fallo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
