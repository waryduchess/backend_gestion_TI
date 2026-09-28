import { Prisma, EstadoActivo } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  ActivoDetalle,
  ActivoResumen,
  ParametrosListadoActivos,
  ResultadoListadoActivos,
} from '../models/activo.model';

const SELECT_USUARIO = {
  select: { id: true, nombre: true, email: true },
} as const;

const construirFiltros = (
  parametros: ParametrosListadoActivos
): Prisma.ActivoWhereInput => {
  const { tipo, estado, sucursal, responsableId, q } = parametros;

  const busqueda: Prisma.ActivoWhereInput | undefined =
    q === undefined || q === ''
      ? undefined
      : {
          OR: [
            { claveActivo: { contains: q } },
            { cb23: { contains: q } },
            { numeroSerie: { contains: q } },
            { modelo: { contains: q } },
            { marca: { contains: q } },
            { nombreRed: { contains: q } },
          ],
        };

  return {
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
    ...(sucursal ? { sucursal } : {}),
    ...(responsableId ? { responsableId } : {}),
    ...(busqueda ? { AND: [busqueda] } : {}),
  };
};

const mapearResumen = (
  fila: Prisma.ActivoGetPayload<{
    include: { responsable: typeof SELECT_USUARIO };
  }>
): ActivoResumen => ({
  id: fila.id,
  claveActivo: fila.claveActivo,
  cb23: fila.cb23,
  tipo: fila.tipo,
  marca: fila.marca,
  modelo: fila.modelo,
  numeroSerie: fila.numeroSerie,
  sucursal: fila.sucursal,
  estado: fila.estado,
  estadoGeneral: fila.estadoGeneral,
  nombreRed: fila.nombreRed,
  responsable: fila.responsable,
});

export const listar = async (
  parametros: ParametrosListadoActivos
): Promise<ResultadoListadoActivos> => {
  const { page, limit } = parametros;
  const skip = (page - 1) * limit;
  const filtros = construirFiltros(parametros);

  const [filas, total] = await Promise.all([
    prisma.activo.findMany({
      where: filtros,
      skip,
      take: limit,
      orderBy: [{ claveActivo: 'asc' }, { id: 'asc' }],
      include: { responsable: SELECT_USUARIO },
    }),
    prisma.activo.count({ where: filtros }),
  ]);

  return {
    activos: filas.map(mapearResumen),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const obtenerPorId = async (id: number): Promise<ActivoDetalle> => {
  const fila = await prisma.activo.findUnique({
    where: { id },
    include: {
      responsable: SELECT_USUARIO,
      asignaciones: {
        where: { activa: true },
        orderBy: { fechaAsignacion: 'desc' },
        include: { usuario: SELECT_USUARIO },
      },
    },
  });

  if (!fila) {
    throw new HttpError(404, 'Activo no encontrado', [{ campo: 'id', valor: String(id) }]);
  }

  const { asignaciones, ...resto } = fila;

  return {
    ...mapearResumen({ ...resto, responsable: fila.responsable }),
    numeroParte: resto.numeroParte,
    anydesk: resto.anydesk,
    procesador: resto.procesador,
    memoria: resto.memoria,
    notas: resto.notas,
    asignaciones: asignaciones.map((asignacion) => ({
      id: asignacion.id,
      activa: asignacion.activa,
      fechaAsignacion: asignacion.fechaAsignacion,
      usuario: asignacion.usuario,
    })),
  };
};

export const ESTADOS_DE_ACTIVO: EstadoActivo[] = Object.values(EstadoActivo);
