import { prisma } from '../config/prisma';
import { Prisma } from '../generated/prisma/client';
import {
  DatosCreacionIncidencia,
  IncidenciaDetalle,
  IncidenciaLista,
  MetadatosPaginacion,
  ParametrosListadoIncidencias,
} from '../models/incidencia.model';
import { HttpError } from '../middlewares/error.middleware';
import { emitirIncidenciaNueva } from '../config/socket';

interface ResultadoListado {
  incidencias: IncidenciaLista[];
  meta: MetadatosPaginacion;
}

const LISTADO_INCIDENCIAS = {
  solicitante: { select: { id: true, nombre: true, email: true } },
  asignadoA: { select: { id: true, nombre: true, email: true } },
  departamento: { select: { id: true, nombre: true } },
  _count: { select: { actualizaciones: true } },
} as const;

type IncidenciaConResumen = Prisma.IncidenciaGetPayload<{
  include: typeof LISTADO_INCIDENCIAS;
}>;

const mapearIncidenciaLista = (fila: IncidenciaConResumen): IncidenciaLista => ({
  id: fila.id,
  originalId: fila.originalId,
  titulo: fila.titulo,
  estado: fila.estado,
  prioridad: fila.prioridad,
  tipoRequerimiento: fila.tipoRequerimiento,
  fechaNotificacion: fila.fechaNotificacion,
  fechaResolucion: fila.fechaResolucion,
  solicitante: fila.solicitante,
  asignadoA: fila.asignadoA,
  departamento: fila.departamento,
  totalActualizaciones: fila._count.actualizaciones,
});

export const crear = async (
  datos: DatosCreacionIncidencia
): Promise<IncidenciaLista> => {
  if (datos.departamentoId !== null) {
    const departamento = await prisma.departamento.findFirst({
      where: { id: datos.departamentoId, activo: true },
      select: { id: true },
    });

    if (!departamento) {
      throw new HttpError(
        400,
        'El departamento no existe o esta inactivo',
        [{ campo: 'departamentoId', valor: datos.departamentoId }]
      );
    }
  }

  const fila = await prisma.incidencia.create({
    data: {
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      tipoRequerimiento: datos.tipoRequerimiento,
      solicitanteId: datos.solicitanteId,
      departamentoId: datos.departamentoId,
    },
    include: LISTADO_INCIDENCIAS,
  });
  const incidencia = mapearIncidenciaLista(fila);

  emitirIncidenciaNueva({
    id: incidencia.id,
    titulo: incidencia.titulo,
    estado: incidencia.estado,
    prioridad: incidencia.prioridad,
    fechaNotificacion: incidencia.fechaNotificacion.toISOString(),
  });

  return incidencia;
};

export const obtenerPorId = async (id: number): Promise<IncidenciaDetalle> => {
  const fila = await prisma.incidencia.findUnique({
    where: { id },
    include: {
      ...LISTADO_INCIDENCIAS,
      actualizaciones: {
        select: { id: true, texto: true, creadaEn: true },
        orderBy: [{ creadaEn: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!fila) {
    throw new HttpError(404, 'Incidencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  return {
    ...mapearIncidenciaLista(fila),
    descripcion: fila.descripcion,
    evidenciaUrl: fila.evidenciaUrl,
    actualizaciones: fila.actualizaciones,
  };
};

export const listar = async (
  parametros: ParametrosListadoIncidencias
): Promise<ResultadoListado> => {
  const { page, limit, estado, prioridad } = parametros;
  const skip = (page - 1) * limit;

  const filtros = {
    ...(estado !== undefined ? { estado } : {}),
    ...(prioridad !== undefined ? { prioridad } : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.incidencia.findMany({
      where: filtros,
      skip,
      take: limit,
      orderBy: [{ fechaNotificacion: 'desc' }, { id: 'desc' }],
      include: LISTADO_INCIDENCIAS,
    }),
    prisma.incidencia.count({ where: filtros }),
  ]);

  const incidencias: IncidenciaLista[] = filas.map(mapearIncidenciaLista);

  return {
    incidencias,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};
