import { prisma } from '../config/prisma';
import {
  IncidenciaLista,
  MetadatosPaginacion,
  ParametrosListadoIncidencias,
} from '../models/incidencia.model';

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

  const incidencias: IncidenciaLista[] = filas.map((fila) => ({
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
  }));

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
