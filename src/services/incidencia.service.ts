import { prisma } from '../config/prisma';
import { EstadoIncidencia, Prisma } from '../generated/prisma/client';
import { PERMISOS_DISPONIBLES } from '../models/rol.model';
import {
  DatosCreacionIncidencia,
  IncidenciaDetalle,
  IncidenciaLista,
  MetadatosPaginacion,
  ParametrosListadoIncidencias,
} from '../models/incidencia.model';
import { HttpError } from '../middlewares/error.middleware';
import { emitirCambioEstadoIncidencia, emitirIncidenciaNueva } from '../config/socket';

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
  orden: fila.orden,
  solicitante: fila.solicitante,
  asignadoA: fila.asignadoA,
  departamento: fila.departamento,
  totalActualizaciones: fila._count.actualizaciones,
});

const tienePermisoParaLeerIncidencias = (permisos: Prisma.JsonValue): boolean =>
  Array.isArray(permisos) &&
  permisos.every(
    (permiso) =>
      typeof permiso === 'string' &&
      PERMISOS_DISPONIBLES.some((permitido) => permitido === permiso)
  ) &&
  permisos.includes('incidencias:leer') &&
  permisos.includes('notificaciones:leer');

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

  const usuariosActivos = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: { is: { activo: true } },
    },
    select: {
      id: true,
      rol: { select: { permisos: true } },
    },
  });
  const destinatarios = usuariosActivos
    .filter(
      (usuario) =>
        usuario.rol !== null &&
        tienePermisoParaLeerIncidencias(usuario.rol.permisos)
    )
    .map((usuario) => usuario.id);

  const { fila, notificaciones } = await prisma.$transaction(async (tx) => {
    const agregado = await tx.incidencia.aggregate({
      where: { estado: EstadoIncidencia.NUEVO },
      _max: { orden: true },
    });
    const orden = (agregado._max.orden ?? -1) + 1;

    const incidenciaCreada = await tx.incidencia.create({
      data: {
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        tipoRequerimiento: datos.tipoRequerimiento,
        solicitanteId: datos.solicitanteId,
        departamentoId: datos.departamentoId,
        orden,
      },
      include: LISTADO_INCIDENCIAS,
    });

    if (destinatarios.length === 0) {
      return { fila: incidenciaCreada, notificaciones: [] };
    }

    await tx.notificacion.createMany({
      data: destinatarios.map((usuarioId) => ({
        usuarioId,
        incidenciaId: incidenciaCreada.id,
      })),
    });

    const filasNotificacion = await tx.notificacion.findMany({
      where: {
        incidenciaId: incidenciaCreada.id,
        usuarioId: { in: destinatarios },
      },
      select: { id: true, usuarioId: true },
    });

    return { fila: incidenciaCreada, notificaciones: filasNotificacion };
  });

  const incidencia = mapearIncidenciaLista(fila);
  const fechaNotificacion = incidencia.fechaNotificacion.toISOString();
  for (const notificacion of notificaciones) {
    emitirIncidenciaNueva(notificacion.usuarioId, {
      id: incidencia.id,
      titulo: incidencia.titulo,
      estado: incidencia.estado,
      prioridad: incidencia.prioridad,
      fechaNotificacion,
      notificacionId: notificacion.id,
    });
  }

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

export const cambiarEstado = async (
  id: number,
  estado: EstadoIncidencia,
  orden?: number
): Promise<IncidenciaLista> => {
  const actual = await prisma.incidencia.findUnique({
    where: { id },
    select: { id: true, titulo: true, estado: true },
  });

  if (!actual) {
    throw new HttpError(404, 'Incidencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  const cambiaEstado = actual.estado !== estado;

  if (!cambiaEstado && orden === undefined) {
    const fila = await prisma.incidencia.findUnique({
      where: { id },
      include: LISTADO_INCIDENCIAS,
    });

    if (!fila) {
      throw new HttpError(404, 'Incidencia no encontrada', [
        { campo: 'id', valor: id },
      ]);
    }

    return mapearIncidenciaLista(fila);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const destinoActual = await tx.incidencia.findMany({
        where: { estado, id: { not: id } },
        orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });

      const idsDestino = destinoActual.map((registro) => registro.id);
      const posicion =
        orden === undefined
          ? idsDestino.length
          : Math.min(Math.max(orden, 0), idsDestino.length);
      idsDestino.splice(posicion, 0, id);

      for (let indice = 0; indice < idsDestino.length; indice += 1) {
        await tx.incidencia.update({
          where: { id: idsDestino[indice] },
          data: { orden: indice },
        });
      }

      if (cambiaEstado) {
        const origenActual = await tx.incidencia.findMany({
          where: { estado: actual.estado, id: { not: id } },
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
          select: { id: true },
        });

        for (let indice = 0; indice < origenActual.length; indice += 1) {
          await tx.incidencia.update({
            where: { id: origenActual[indice].id },
            data: { orden: indice },
          });
        }

        await tx.incidencia.update({
          where: { id },
          data: {
            estado,
            fechaResolucion: estado === 'COMPLETADO' ? new Date() : null,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new HttpError(404, 'Incidencia no encontrada', [
        { campo: 'id', valor: id },
      ]);
    }
    throw error;
  }

  const fila = await prisma.incidencia.findUnique({
    where: { id },
    include: LISTADO_INCIDENCIAS,
  });

  if (!fila) {
    throw new HttpError(404, 'Incidencia no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  if (cambiaEstado) {
    emitirCambioEstadoIncidencia({
      id: fila.id,
      titulo: fila.titulo,
      estadoAnterior: actual.estado,
      estado: fila.estado,
      fechaCambio: new Date().toISOString(),
    });
  }

  return mapearIncidenciaLista(fila);
};
