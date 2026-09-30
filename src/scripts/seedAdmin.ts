import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { PERMISOS_DISPONIBLES } from '../models/rol.model';

const ID_ADMIN = 'ADMIN';
const NOMBRE_ROL_ADMIN = 'Administrador';
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
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: NOMBRE_ROL_ADMIN },
    update: { permisos: [...PERMISOS_DISPONIBLES], activo: true },
    create: {
      nombre: NOMBRE_ROL_ADMIN,
      permisos: [...PERMISOS_DISPONIBLES],
      activo: true,
    },
  });

  const usuario = await prisma.usuario.upsert({
    where: { id: ID_ADMIN },
    update: { nombre, email, activo: true, passwordHash, rolId: rolAdmin.id },
    create: {
      id: ID_ADMIN,
      nombre,
      email,
      activo: true,
      passwordHash,
      rolId: rolAdmin.id,
    },
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
