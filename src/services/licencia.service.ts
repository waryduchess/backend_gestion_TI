import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionLicencia,
  DatosEdicionLicencia,
  LicenciaResumen,
  ParametrosListadoLicencias,
} from '../models/licencia.model';
import { MetadatosPaginacion, UsuarioResumen } from '../models/comun.model';
import { cifrar } from '../utils/crypto';

const seleccionarLicencia = {
  id: true,
  software: true,
  clave: true,
  proveedor: true,
  fechaCompra: true,
  fechaVencimiento: true,
  activa: true,
  asignadaA: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
} as const;

type FilaLicencia = Prisma.LicenciaGetPayload<{
  select: typeof seleccionarLicencia;
}>;

export interface ResultadoListadoLicencias {
  licencias: LicenciaResumen[];
  meta: MetadatosPaginacion;
}

const mapearLicencia = (fila: FilaLicencia): LicenciaResumen => {
  const asignadaA: UsuarioResumen | null = fila.asignadaA
    ? {
        id: fila.asignadaA.id,
        nombre: fila.asignadaA.nombre,
        email: fila.asignadaA.email,
      }
    : null;

  return {
    id: fila.id,
    software: fila.software,
    tieneClave: fila.clave !== null,
    proveedor: fila.proveedor,
    fechaCompra: fila.fechaCompra,
    fechaVencimiento: fila.fechaVencimiento,
    activa: fila.activa,
    asignadaA,
  };
};

const obtenerLicenciaActiva = async (id: number): Promise<FilaLicencia> => {
  const fila = await prisma.licencia.findFirst({
    where: { id, activa: true },
    select: seleccionarLicencia,
  });
  if (!fila) {
    throw new HttpError(404, 'Licencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  return fila;
};

const verificarUsuarioAsignado = async (
  asignadaAId: string | null
): Promise<void> => {
  if (asignadaAId === null) return;
  const usuario = await prisma.usuario.findFirst({
    where: { id: asignadaAId, activo: true },
    select: { id: true },
  });
  if (!usuario) {
    throw new HttpError(400, 'El usuario asignado no existe o esta inactivo', [
      { campo: 'asignadaAId', valor: asignadaAId },
    ]);
  }
};

export const listarLicencias = async (
  parametros: ParametrosListadoLicencias
): Promise<ResultadoListadoLicencias> => {
  const where: Prisma.LicenciaWhereInput = {
    ...(parametros.activa !== undefined ? { activa: parametros.activa } : {}),
    ...(parametros.proveedor
      ? { proveedor: { contains: parametros.proveedor } }
      : {}),
    ...(parametros.venceDesde || parametros.venceHasta
      ? {
          fechaVencimiento: {
            ...(parametros.venceDesde ? { gte: parametros.venceDesde } : {}),
            ...(parametros.venceHasta
              ? {
                  lt: new Date(
                    parametros.venceHasta.getTime() + 24 * 60 * 60 * 1000
                  ),
                }
              : {}),
          },
        }
      : {}),
    ...(parametros.q
      ? {
          OR: [
            { software: { contains: parametros.q } },
            { proveedor: { contains: parametros.q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.licencia.findMany({
      where,
      select: seleccionarLicencia,
      orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.licencia.count({ where }),
  ]);

  return {
    licencias: filas.map(mapearLicencia),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerLicencia = async (id: number): Promise<LicenciaResumen> =>
  mapearLicencia(await obtenerLicenciaActiva(id));

export const crearLicencia = async (
  datos: DatosCreacionLicencia
): Promise<LicenciaResumen> => {
  await verificarUsuarioAsignado(datos.asignadaAId);
  const fila = await prisma.licencia.create({
    data: {
      software: datos.software,
      clave: datos.clave === null ? null : cifrar(datos.clave),
      proveedor: datos.proveedor,
      fechaCompra: datos.fechaCompra,
      fechaVencimiento: datos.fechaVencimiento,
      asignadaAId: datos.asignadaAId,
    },
    select: seleccionarLicencia,
  });
  return mapearLicencia(fila);
};

export const actualizarLicencia = async (
  id: number,
  datos: DatosEdicionLicencia
): Promise<LicenciaResumen> => {
  const existente = await prisma.licencia.findUnique({
    where: { id },
    select: { activa: true },
  });
  if (!existente || (!existente.activa && datos.activa !== true)) {
    throw new HttpError(404, 'Licencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  if (datos.asignadaAId !== undefined) {
    await verificarUsuarioAsignado(datos.asignadaAId);
  }

  const data: Prisma.LicenciaUpdateInput = {
    ...(datos.software !== undefined ? { software: datos.software } : {}),
    ...(datos.clave !== undefined
      ? { clave: datos.clave === null ? null : cifrar(datos.clave) }
      : {}),
    ...(datos.proveedor !== undefined ? { proveedor: datos.proveedor } : {}),
    ...(datos.fechaCompra !== undefined
      ? { fechaCompra: datos.fechaCompra }
      : {}),
    ...(datos.fechaVencimiento !== undefined
      ? {
          fechaVencimiento: datos.fechaVencimiento,
          ultimaAlertaVencimiento: null,
        }
      : {}),
    ...(datos.asignadaAId !== undefined
      ? {
          asignadaA:
            datos.asignadaAId === null
              ? { disconnect: true }
              : { connect: { id: datos.asignadaAId } },
          ultimaAlertaVencimiento: null,
        }
      : {}),
    ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
  };

  const fila = await prisma.licencia.update({
    where: { id },
    data,
    select: seleccionarLicencia,
  });
  return mapearLicencia(fila);
};

export const desactivarLicencia = async (
  id: number
): Promise<LicenciaResumen> => {
  const fila = await prisma.licencia.findUnique({
    where: { id },
    select: seleccionarLicencia,
  });
  if (!fila) {
    throw new HttpError(404, 'Licencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  if (!fila.activa) return mapearLicencia(fila);

  const desactivada = await prisma.licencia.update({
    where: { id },
    data: { activa: false },
    select: seleccionarLicencia,
  });
  return mapearLicencia(desactivada);
};
