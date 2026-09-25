import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta la variable de entorno DATABASE_URL');
}

const adapter = new PrismaMariaDb(connectionString);

export const prisma = new PrismaClient({ adapter });

export type { PrismaClient };
