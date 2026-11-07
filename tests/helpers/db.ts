import bcrypt from 'bcryptjs';
import {
  EstadoIncidencia,
  Prisma,
  TipoRequerimiento,
} from '../../src/generated/prisma/client';
import { prisma } from '../../src/config/prisma';
import { PERMISOS_DISPONIBLES } from '../../src/models/rol.model';
import { firmarToken } from '../../src/utils/jwt';

export const PASSWORD_PRUEBA = 'ClaveSegura123!';

export const limpiarBaseDeDatos = async (): Promise<void> => {
  await prisma.notificacion.deleteMany();
  await prisma.actualizacionIncidencia.deleteMany();
  await prisma.incidencia.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.rol.deleteMany();
  await prisma.departamento.deleteMany();
};

export interface ContextoPrueba {
  adminId: string;
  usuarioLimitadoId: string;
  adminEmail: string;
  usuarioLimitadoEmail: string;
  departamentoId: number;
  tokenAdmin: string;
  tokenLimitado: string;
}

export const crearContextoPrueba = async (): Promise<ContextoPrueba> => {
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);

  const rolAdmin = await prisma.rol.create({
    data: {
      nombre: 'ROL_PRUEBAS_ADMIN',
      permisos: [...PERMISOS_DISPONIBLES] as Prisma.InputJsonValue,
    },
  });

  const rolLimitado = await prisma.rol.create({
    data: {
      nombre: 'ROL_PRUEBAS_LIMITADO',
      permisos: ['incidencias:leer'] as Prisma.InputJsonValue,
    },
  });

  const departamento = await prisma.departamento.create({
    data: { nombre: 'DEPARTAMENTO_PRUEBAS' },
  });

  const adminEmail = 'admin.pruebas@gestion-ti.local';
  const usuarioLimitadoEmail = 'usuario.pruebas@gestion-ti.local';

  const admin = await prisma.usuario.create({
    data: {
      id: 'TEST-ADMIN',
      nombre: 'Admin de Pruebas',
      email: adminEmail,
      passwordHash,
      activo: true,
      departamentoId: departamento.id,
      rolId: rolAdmin.id,
    },
  });

  const usuarioLimitado = await prisma.usuario.create({
    data: {
      id: 'TEST-USER',
      nombre: 'Usuario Limitado de Pruebas',
      email: usuarioLimitadoEmail,
      passwordHash,
      activo: true,
      departamentoId: departamento.id,
      rolId: rolLimitado.id,
    },
  });

  return {
    adminId: admin.id,
    usuarioLimitadoId: usuarioLimitado.id,
    adminEmail,
    usuarioLimitadoEmail,
    departamentoId: departamento.id,
    tokenAdmin: firmarToken({
      id: admin.id,
      nombre: admin.nombre,
      email: admin.email,
    }),
    tokenLimitado: firmarToken({
      id: usuarioLimitado.id,
      nombre: usuarioLimitado.nombre,
      email: usuarioLimitado.email,
    }),
  };
};

export const crearIncidenciaPrueba = async (
  contexto: ContextoPrueba,
  datos: {
    titulo?: string;
    estado?: EstadoIncidencia;
  } = {}
) =>
  prisma.incidencia.create({
    data: {
      titulo: datos.titulo ?? 'Incidencia de pruebas',
      descripcion: 'Descripcion de la incidencia de pruebas',
      tipoRequerimiento: TipoRequerimiento.OTROS,
      estado: datos.estado ?? EstadoIncidencia.NUEVO,
      solicitanteId: contexto.adminId,
      departamentoId: contexto.departamentoId,
    },
  });
