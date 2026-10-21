import { randomUUID } from 'node:crypto';
import {
  EstadoActivo,
  MantenimientoEstado,
  Prisma,
} from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionMantenimiento,
  DatosEdicionMantenimiento,
  MantenimientoResumen,
  ParametrosListadoMantenimiento,
  ResultadoListadoMantenimiento,
} from '../models/mantenimiento.model';
import { registrarAuditoria } from './auditoria.service';
import {
  emitirMantenimientoActualizado,
  emitirMantenimientoCreado,
  emitirMantenimientoEliminado,
  type MantenimientoEvento,
} from '../config/socket';

const INCLUDE_MANTENIMIENTO = {
  activoRel: {
    select: {
      id: true,
      cb23: true,
      tipo: true,
    },
  },
  tecnico: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
} as const;

type FilaMantenimiento = Prisma.OrdenMantenimientoGetPayload<{
  include: typeof INCLUDE_MANTENIMIENTO;
}>;

const TRANSICIONES: Record<MantenimientoEstado, MantenimientoEstado[]> = {
  [MantenimientoEstado.PROGRAMADO]: [
    MantenimientoEstado.EN_PROCESO,
    MantenimientoEstado.CANCELADO,
  ],
  [MantenimientoEstado.EN_PROCESO]: [
    MantenimientoEstado.COMPLETADO,
    MantenimientoEstado.CANCELADO,
  ],
  [MantenimientoEstado.COMPLETADO]: [MantenimientoEstado.CANCELADO],
  [MantenimientoEstado.CANCELADO]: [],
};

const mapearMantenimiento = (
  fila: FilaMantenimiento
): MantenimientoResumen => ({
  id: fila.id,
  folio: fila.folio,
  activoId: fila.activoId,
  activo: fila.activoRel,
  tipo: fila.tipo,
  estado: fila.estado,
  prioridad: fila.prioridad,
  tecnicoId: fila.tecnicoId,
  tecnico: fila.tecnico,
  fechaProgramada: fila.fechaProgramada,
  fechaRealizada: fila.fechaRealizada,
  costo: fila.costo === null ? null : Number(fila.costo),
  descripcion: fila.descripcion,
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const crearEventoMantenimiento = (
  fila: FilaMantenimiento
): MantenimientoEvento => ({
  id: fila.id,
  folio: fila.folio,
  activoId: fila.activoId,
  estado: fila.estado,
  tipo: fila.tipo,
  prioridad: fila.prioridad,
  tecnicoId: fila.tecnicoId,
  fechaProgramada: fila.fechaProgramada.toISOString(),
});

const resolverEstadoRestauracion = (
  estadoPrevio: EstadoActivo | null,
  estadoActual: EstadoActivo,
  responsableId: string | null
): EstadoActivo => {
  if (estadoActual === EstadoActivo.DE_BAJA) {
    return EstadoActivo.DE_BAJA;
  }

  if (
    estadoPrevio !== null &&
    estadoPrevio !== EstadoActivo.DE_BAJA &&
    estadoPrevio !== EstadoActivo.EN_MANTENIMIENTO
  ) {
    return estadoPrevio;
  }

  return responsableId ? EstadoActivo.EN_USO : EstadoActivo.EN_ALMACEN;
};

const verificarActivo = async (
  tx: Prisma.TransactionClient,
  activoId: number
): Promise<void> => {
  const activo = await tx.activo.findUnique({
    where: { id: activoId },
    select: { id: true, estado: true },
  });

  if (!activo) {
    throw new HttpError(404, 'El activo no existe', [
      { campo: 'activoId', valor: activoId },
    ]);
  }

  if (activo.estado === EstadoActivo.DE_BAJA) {
    throw new HttpError(409, 'El activo esta dado de baja', [
      { campo: 'activoId', valor: activoId },
      { campo: 'estado', valor: activo.estado },
    ]);
  }
};

const verificarTecnico = async (
  tx: Prisma.TransactionClient,
  tecnicoId: string
): Promise<void> => {
  const tecnico = await tx.usuario.findFirst({
    where: { id: tecnicoId, activo: true },
    select: { id: true },
  });

  if (!tecnico) {
    throw new HttpError(404, 'El tecnico no existe o esta inactivo', [
      { campo: 'tecnicoId', valor: tecnicoId },
    ]);
  }
};

const verificarOtraOrdenEnProceso = async (
  tx: Prisma.TransactionClient,
  activoId: number,
  excluirId?: number
): Promise<void> => {
  const otra = await tx.ordenMantenimiento.findFirst({
    where: {
      activoId,
      estado: MantenimientoEstado.EN_PROCESO,
      activo: true,
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: { id: true, folio: true },
  });

  if (otra) {
    throw new HttpError(
      409,
      'El activo ya tiene una orden de mantenimiento en proceso',
      [
        { campo: 'activoId', valor: activoId },
        { campo: 'mantenimientoId', valor: otra.id },
        { campo: 'folio', valor: otra.folio },
      ]
    );
  }
};

const auditarCambioEstadoActivo = async (
  tx: Prisma.TransactionClient,
  activoId: number,
  ejecutorId: string,
  estadoAnterior: EstadoActivo,
  estadoNuevo: EstadoActivo
): Promise<void> => {
  if (estadoAnterior === estadoNuevo) return;

  await registrarAuditoria(tx, {
    modulo: 'ACTIVOS',
    accion: 'ACTUALIZAR',
    entidadId: activoId,
    usuarioId: ejecutorId,
    detalle: {
      campos: ['estado'],
      origen: 'MANTENIMIENTO',
      estadoAnterior,
      estadoNuevo,
    },
  });
};

const ponerActivoEnMantenimiento = async (
  tx: Prisma.TransactionClient,
  activoId: number,
  ejecutorId: string
): Promise<EstadoActivo | null> => {
  const activo = await tx.activo.findUnique({
    where: { id: activoId },
    select: { id: true, estado: true },
  });

  if (!activo) {
    throw new HttpError(404, 'El activo no existe', [
      { campo: 'activoId', valor: activoId },
    ]);
  }

  if (activo.estado === EstadoActivo.DE_BAJA) {
    throw new HttpError(409, 'El activo esta dado de baja', [
      { campo: 'activoId', valor: activoId },
      { campo: 'estado', valor: activo.estado },
    ]);
  }

  if (activo.estado === EstadoActivo.EN_MANTENIMIENTO) {
    return null;
  }

  await tx.activo.update({
    where: { id: activoId },
    data: { estado: EstadoActivo.EN_MANTENIMIENTO },
  });
  await auditarCambioEstadoActivo(
    tx,
    activoId,
    ejecutorId,
    activo.estado,
    EstadoActivo.EN_MANTENIMIENTO
  );

  return activo.estado;
};

const restaurarActivo = async (
  tx: Prisma.TransactionClient,
  activoId: number,
  estadoPrevio: EstadoActivo | null,
  ejecutorId: string
): Promise<{ anterior: EstadoActivo; nuevo: EstadoActivo }> => {
  const activo = await tx.activo.findUnique({
    where: { id: activoId },
    select: { id: true, estado: true, responsableId: true },
  });

  if (!activo) {
    throw new HttpError(404, 'El activo no existe', [
      { campo: 'activoId', valor: activoId },
    ]);
  }

  const estadoNuevo = resolverEstadoRestauracion(
    estadoPrevio,
    activo.estado,
    activo.responsableId
  );

  if (estadoNuevo !== activo.estado) {
    await tx.activo.update({
      where: { id: activoId },
      data: { estado: estadoNuevo },
    });
    await auditarCambioEstadoActivo(
      tx,
      activoId,
      ejecutorId,
      activo.estado,
      estadoNuevo
    );
  }

  return { anterior: activo.estado, nuevo: estadoNuevo };
};

const validarFechas = (
  fechaProgramada: Date,
  fechaRealizada: Date | null
): void => {
  if (fechaRealizada && fechaRealizada < fechaProgramada) {
    throw new HttpError(
      400,
      'La fecha de realizacion no puede ser anterior a la fecha programada',
      [
        {
          campo: 'fechaRealizada',
          valor: fechaRealizada.toISOString(),
        },
        {
          campo: 'fechaProgramada',
          valor: fechaProgramada.toISOString(),
        },
      ]
    );
  }
};

const verificarTransicion = (
  estadoActual: MantenimientoEstado,
  estadoDestino: MantenimientoEstado
): void => {
  if (estadoActual === estadoDestino) return;

  if (!TRANSICIONES[estadoActual].includes(estadoDestino)) {
    throw new HttpError(
      409,
      `No se puede cambiar el mantenimiento de ${estadoActual} a ${estadoDestino}`,
      [
        { campo: 'estado', valor: estadoDestino },
        { campo: 'estadoActual', valor: estadoActual },
        { campo: 'permitidos', valor: TRANSICIONES[estadoActual] },
      ]
    );
  }
};

export const listarMantenimientos = async (
  parametros: ParametrosListadoMantenimiento
): Promise<ResultadoListadoMantenimiento> => {
  const { page, limit, q, tipo, estado, prioridad, tecnicoId, activoId } =
    parametros;

  const where: Prisma.OrdenMantenimientoWhereInput = {
    activo: true,
    ...(tipo ? { tipo } : {}),
    ...(estado ? { estado } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(tecnicoId ? { tecnicoId } : {}),
    ...(activoId ? { activoId } : {}),
    ...(q
      ? {
          OR: [
            { folio: { contains: q } },
            { descripcion: { contains: q } },
            {
              activoRel: {
                is: {
                  OR: [
                    { claveActivo: { contains: q } },
                    { cb23: { contains: q } },
                    { tipo: { contains: q } },
                  ],
                },
              },
            },
            { tecnico: { is: { nombre: { contains: q } } } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.ordenMantenimiento.findMany({
      where,
      include: INCLUDE_MANTENIMIENTO,
      orderBy: [{ fechaProgramada: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.ordenMantenimiento.count({ where }),
  ]);

  return {
    mantenimientos: filas.map(mapearMantenimiento),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
};

export const obtenerMantenimiento = async (
  id: number
): Promise<MantenimientoResumen> => {
  const fila = await prisma.ordenMantenimiento.findFirst({
    where: { id, activo: true },
    include: INCLUDE_MANTENIMIENTO,
  });

  if (!fila) {
    throw new HttpError(404, 'Mantenimiento no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }

  return mapearMantenimiento(fila);
};

export const listarMantenimientosPorActivo = async (
  activoId: number
): Promise<MantenimientoResumen[]> => {
  const activo = await prisma.activo.findUnique({
    where: { id: activoId },
    select: { id: true },
  });

  if (!activo) {
    throw new HttpError(404, 'El activo no existe', [
      { campo: 'activoId', valor: activoId },
    ]);
  }

  const filas = await prisma.ordenMantenimiento.findMany({
    where: { activoId, activo: true },
    include: INCLUDE_MANTENIMIENTO,
    orderBy: [{ fechaProgramada: 'desc' }, { id: 'desc' }],
  });

  return filas.map(mapearMantenimiento);
};

export const crearMantenimiento = async (
  datos: DatosCreacionMantenimiento,
  ejecutorId: string
): Promise<MantenimientoResumen> => {
  const fechaRealizada =
    datos.estado === MantenimientoEstado.COMPLETADO
      ? datos.fechaRealizada ?? new Date()
      : datos.fechaRealizada;

  validarFechas(datos.fechaProgramada, fechaRealizada);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarActivo(tx, datos.activoId);
    await verificarTecnico(tx, datos.tecnicoId);

    let estadoActivoPrevio: EstadoActivo | null = null;
    if (datos.estado === MantenimientoEstado.EN_PROCESO) {
      await verificarOtraOrdenEnProceso(tx, datos.activoId);
      estadoActivoPrevio = await ponerActivoEnMantenimiento(
        tx,
        datos.activoId,
        ejecutorId
      );
    }

    const creado = await tx.ordenMantenimiento.create({
      data: {
        folio: `TMP-${randomUUID()}`,
        activoId: datos.activoId,
        tipo: datos.tipo,
        estado: datos.estado,
        estadoActivoPrevio,
        prioridad: datos.prioridad,
        tecnicoId: datos.tecnicoId,
        fechaProgramada: datos.fechaProgramada,
        fechaRealizada,
        costo: datos.costo,
        descripcion: datos.descripcion,
      },
      select: { id: true },
    });

    const folio = `MTO-${String(creado.id).padStart(4, '0')}`;
    const actualizado = await tx.ordenMantenimiento.update({
      where: { id: creado.id },
      data: { folio },
      include: INCLUDE_MANTENIMIENTO,
    });

    await registrarAuditoria(tx, {
      modulo: 'MANTENIMIENTO',
      accion: 'CREAR',
      entidadId: actualizado.id,
      usuarioId: ejecutorId,
      detalle: {
        campos: [
          'activoId',
          'tipo',
          'estado',
          'prioridad',
          'tecnicoId',
          'fechaProgramada',
        ],
        ...(datos.estado === MantenimientoEstado.EN_PROCESO
          ? {
              activoEstado: {
                anterior: estadoActivoPrevio,
                nuevo: EstadoActivo.EN_MANTENIMIENTO,
              },
            }
          : {}),
      },
    });

    return actualizado;
  });

  emitirMantenimientoCreado(crearEventoMantenimiento(fila));
  return mapearMantenimiento(fila);
};

export const actualizarMantenimiento = async (
  id: number,
  datos: DatosEdicionMantenimiento,
  ejecutorId: string
): Promise<MantenimientoResumen> => {
  let estadoAnterior: MantenimientoEstado;
  let fila: FilaMantenimiento;

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const existente = await tx.ordenMantenimiento.findFirst({
        where: { id, activo: true },
        select: {
          id: true,
          estado: true,
          activoId: true,
          tecnicoId: true,
          fechaProgramada: true,
          fechaRealizada: true,
          estadoActivoPrevio: true,
        },
      });

      if (!existente) {
        throw new HttpError(404, 'Mantenimiento no encontrado', [
          { campo: 'id', valor: id },
        ]);
      }

      const estadoDestino = datos.estado ?? existente.estado;
      verificarTransicion(existente.estado, estadoDestino);

      if (existente.estado === MantenimientoEstado.COMPLETADO) {
        const campos = Object.keys(datos);
        const soloCancela =
          campos.length === 1 &&
          campos[0] === 'estado' &&
          estadoDestino === MantenimientoEstado.CANCELADO;

        if (!soloCancela) {
          throw new HttpError(
            409,
            'Un mantenimiento completado solo se puede cancelar',
            [
              { campo: 'estado', valor: estadoDestino },
              { campo: 'estadoActual', valor: existente.estado },
            ]
          );
        }
      }

      const activoIdDestino = datos.activoId ?? existente.activoId;

      if (datos.activoId !== undefined && datos.activoId !== existente.activoId) {
        if (existente.estado === MantenimientoEstado.EN_PROCESO) {
          throw new HttpError(
            409,
            'No se puede cambiar el activo de una orden en proceso',
            [
              { campo: 'activoId', valor: datos.activoId },
              { campo: 'activoActualId', valor: existente.activoId },
            ]
          );
        }
        await verificarActivo(tx, datos.activoId);
      }

      if (
        datos.tecnicoId !== undefined &&
        datos.tecnicoId !== existente.tecnicoId
      ) {
        await verificarTecnico(tx, datos.tecnicoId);
      }

      const fechaProgramada =
        datos.fechaProgramada ?? existente.fechaProgramada;
      let fechaRealizada =
        datos.fechaRealizada !== undefined
          ? datos.fechaRealizada
          : existente.fechaRealizada;

      if (
        estadoDestino === MantenimientoEstado.COMPLETADO &&
        existente.estado !== MantenimientoEstado.COMPLETADO &&
        fechaRealizada === null
      ) {
        fechaRealizada = new Date();
      }

      if (
        estadoDestino !== MantenimientoEstado.COMPLETADO &&
        existente.estado === MantenimientoEstado.COMPLETADO
      ) {
        fechaRealizada = null;
      }

      validarFechas(fechaProgramada, fechaRealizada);

      let estadoActivoPrevio: EstadoActivo | null | undefined;
      let cambioEstadoActivo:
        | { anterior: EstadoActivo | null; nuevo: EstadoActivo }
        | undefined;

      if (
        existente.estado !== MantenimientoEstado.EN_PROCESO &&
        estadoDestino === MantenimientoEstado.EN_PROCESO
      ) {
        await verificarOtraOrdenEnProceso(tx, activoIdDestino, id);
        const previo = await ponerActivoEnMantenimiento(
          tx,
          activoIdDestino,
          ejecutorId
        );
        estadoActivoPrevio = previo;
        cambioEstadoActivo = {
          anterior: previo,
          nuevo: EstadoActivo.EN_MANTENIMIENTO,
        };
      } else if (
        existente.estado === MantenimientoEstado.EN_PROCESO &&
        estadoDestino !== MantenimientoEstado.EN_PROCESO
      ) {
        const restauracion = await restaurarActivo(
          tx,
          existente.activoId,
          existente.estadoActivoPrevio,
          ejecutorId
        );
        estadoActivoPrevio = null;
        cambioEstadoActivo = restauracion;
      }

      const data: Prisma.OrdenMantenimientoUncheckedUpdateInput = {
        ...(datos.activoId !== undefined ? { activoId: datos.activoId } : {}),
        ...(datos.tipo !== undefined ? { tipo: datos.tipo } : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        ...(datos.prioridad !== undefined
          ? { prioridad: datos.prioridad }
          : {}),
        ...(datos.tecnicoId !== undefined
          ? { tecnicoId: datos.tecnicoId }
          : {}),
        ...(datos.costo !== undefined ? { costo: datos.costo } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion }
          : {}),
        ...(estadoActivoPrevio !== undefined ? { estadoActivoPrevio } : {}),
        fechaProgramada,
        fechaRealizada,
      };

      const actualizado = await tx.ordenMantenimiento.update({
        where: { id },
        data,
        include: INCLUDE_MANTENIMIENTO,
      });

      await registrarAuditoria(tx, {
        modulo: 'MANTENIMIENTO',
        accion: 'ACTUALIZAR',
        entidadId: id,
        usuarioId: ejecutorId,
        detalle: {
          campos: Object.keys(datos),
          ...(cambioEstadoActivo
            ? { activoEstado: cambioEstadoActivo }
            : {}),
        },
      });

      return { fila: actualizado, estado: existente.estado };
    });

    fila = resultado.fila;
    estadoAnterior = resultado.estado;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new HttpError(404, 'Mantenimiento no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }
    throw error;
  }

  emitirMantenimientoActualizado({
    ...crearEventoMantenimiento(fila),
    estadoAnterior,
  });

  return mapearMantenimiento(fila);
};

export const desactivarMantenimiento = async (
  id: number,
  ejecutorId: string
): Promise<void> => {
  const eliminado = await prisma.$transaction(async (tx) => {
    const existente = await tx.ordenMantenimiento.findUnique({
      where: { id },
      select: {
        id: true,
        folio: true,
        activoId: true,
        activo: true,
        estado: true,
      },
    });

    if (!existente) {
      throw new HttpError(404, 'Mantenimiento no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    if (!existente.activo) return null;

    if (existente.estado === MantenimientoEstado.EN_PROCESO) {
      throw new HttpError(
        409,
        'No se puede eliminar una orden en proceso; cancelala primero',
        [
          { campo: 'id', valor: id },
          { campo: 'estado', valor: existente.estado },
        ]
      );
    }

    await tx.ordenMantenimiento.update({
      where: { id },
      data: { activo: false },
    });

    await registrarAuditoria(tx, {
      modulo: 'MANTENIMIENTO',
      accion: 'DESACTIVAR',
      entidadId: id,
      usuarioId: ejecutorId,
      detalle: { campos: ['activo'] },
    });

    return existente;
  });

  if (eliminado) {
    emitirMantenimientoEliminado({
      id: eliminado.id,
      folio: eliminado.folio,
      activoId: eliminado.activoId,
    });
  }
};
