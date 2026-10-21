import { EstadoTarea, Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionTarea,
  DatosEdicionTarea,
  ParametrosListadoTareas,
  ResultadoListadoTareas,
  TareaResumen,
} from '../models/proyecto-tarea.model';
import { registrarAuditoria } from './auditoria.service';

const INCLUDE_TAREA = {
  asignadoA: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
  subtareas: {
    where: { activo: true },
    orderBy: [
      { orden: 'asc' },
      { id: 'asc' },
    ] as Prisma.ProyectoTareaOrderByWithRelationInput[],
    include: {
      asignadoA: {
        select: {
          id: true,
          nombre: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.ProyectoTareaInclude;

type FilaTarea = Prisma.ProyectoTareaGetPayload<{
  include: typeof INCLUDE_TAREA;
}>;

const mapearTarea = (fila: FilaTarea): TareaResumen => ({
  id: fila.id,
  proyectoId: fila.proyectoId,
  parentId: fila.parentId,
  titulo: fila.titulo,
  descripcion: fila.descripcion,
  estado: fila.estado,
  prioridad: fila.prioridad,
  asignadoAId: fila.asignadoAId,
  asignadoA: fila.asignadoA,
  fechaInicio: fila.fechaInicio,
  fechaVencimiento: fila.fechaVencimiento,
  fechaCompletada: fila.fechaCompletada,
  orden: fila.orden,
  activo: fila.activo,
  subtareas: fila.subtareas.map((subtarea) => ({
    id: subtarea.id,
    proyectoId: subtarea.proyectoId,
    parentId: subtarea.parentId,
    titulo: subtarea.titulo,
    descripcion: subtarea.descripcion,
    estado: subtarea.estado,
    prioridad: subtarea.prioridad,
    asignadoAId: subtarea.asignadoAId,
    asignadoA: subtarea.asignadoA,
    fechaInicio: subtarea.fechaInicio,
    fechaVencimiento: subtarea.fechaVencimiento,
    fechaCompletada: subtarea.fechaCompletada,
    orden: subtarea.orden,
    activo: subtarea.activo,
    subtareas: [],
    createdAt: subtarea.createdAt,
    updatedAt: subtarea.updatedAt,
  })),
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const verificarProyectoActivo = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number
): Promise<void> => {
  const proyecto = await cliente.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }
};

const validarAsignado = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  asignadoAId: string | null
): Promise<void> => {
  if (asignadoAId === null) return;

  const proyecto = await cliente.proyecto.findUnique({
    where: { id: proyectoId },
    select: { responsableId: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }

  const usuario = await cliente.usuario.findFirst({
    where: { id: asignadoAId, activo: true },
    select: { id: true },
  });
  if (!usuario) {
    throw new HttpError(400, 'El usuario asignado no existe o esta inactivo', [
      { campo: 'asignadoAId', valor: asignadoAId },
    ]);
  }

  if (proyecto.responsableId === asignadoAId) return;

  const miembro = await cliente.proyectoMiembro.findUnique({
    where: {
      proyectoId_usuarioId: { proyectoId, usuarioId: asignadoAId },
    },
    select: { usuarioId: true },
  });
  if (!miembro) {
    throw new HttpError(
      400,
      'El usuario asignado no pertenece al proyecto',
      [{ campo: 'asignadoAId', valor: asignadoAId }]
    );
  }
};

const validarFechas = (
  fechaInicio: Date | null,
  fechaVencimiento: Date | null,
  fechaCompletada: Date | null
): void => {
  if (
    fechaInicio &&
    fechaVencimiento &&
    fechaVencimiento.getTime() < fechaInicio.getTime()
  ) {
    throw new HttpError(
      400,
      '"fechaVencimiento" no puede ser anterior a "fechaInicio"',
      [{ campo: 'fechaVencimiento', valor: fechaVencimiento.toISOString() }]
    );
  }
  if (
    fechaInicio &&
    fechaCompletada &&
    fechaCompletada.getTime() < fechaInicio.getTime()
  ) {
    throw new HttpError(
      400,
      '"fechaCompletada" no puede ser anterior a "fechaInicio"',
      [{ campo: 'fechaCompletada', valor: fechaCompletada.toISOString() }]
    );
  }
};

const validarFechaCompletada = (
  estado: EstadoTarea,
  fechaCompletada: Date | null
): void => {
  if (fechaCompletada !== null && estado !== EstadoTarea.COMPLETADA) {
    throw new HttpError(
      400,
      '"fechaCompletada" solo se permite cuando el estado es COMPLETADA',
      [{ campo: 'fechaCompletada', valor: fechaCompletada.toISOString() }]
    );
  }
};

const validarParent = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  parentId: number
): Promise<void> => {
  const parent = await cliente.proyectoTarea.findFirst({
    where: { id: parentId, proyectoId, activo: true },
    select: { id: true, parentId: true },
  });
  if (!parent) {
    throw new HttpError(404, 'Tarea padre no encontrada', [
      { campo: 'parentId', valor: parentId },
    ]);
  }
  if (parent.parentId !== null) {
    throw new HttpError(
      400,
      'No se permiten subtareas de subtareas',
      [{ campo: 'parentId', valor: parentId }]
    );
  }
};

const verificarProyectoParaLectura = async (proyectoId: number): Promise<void> => {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }
};

export const listarTareas = async (
  proyectoId: number,
  parametros: ParametrosListadoTareas
): Promise<ResultadoListadoTareas> => {
  await verificarProyectoParaLectura(proyectoId);

  const where: Prisma.ProyectoTareaWhereInput = {
    proyectoId,
    activo: true,
    parentId: null,
    ...(parametros.estado ? { estado: parametros.estado } : {}),
    ...(parametros.prioridad ? { prioridad: parametros.prioridad } : {}),
    ...(parametros.asignadoAId
      ? { asignadoAId: parametros.asignadoAId }
      : {}),
    ...(parametros.q
      ? {
          OR: [
            { titulo: { contains: parametros.q } },
            { descripcion: { contains: parametros.q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.proyectoTarea.findMany({
      where,
      include: INCLUDE_TAREA,
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.proyectoTarea.count({ where }),
  ]);

  return {
    tareas: filas.map(mapearTarea),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerTarea = async (
  proyectoId: number,
  tareaId: number
): Promise<TareaResumen> => {
  await verificarProyectoParaLectura(proyectoId);

  const fila = await prisma.proyectoTarea.findFirst({
    where: { id: tareaId, proyectoId, activo: true },
    include: INCLUDE_TAREA,
  });
  if (!fila) {
    throw new HttpError(404, 'Tarea no encontrada', [
      { campo: 'tareaId', valor: tareaId },
    ]);
  }
  return mapearTarea(fila);
};

export const crearTarea = async (
  proyectoId: number,
  datos: DatosCreacionTarea,
  ejecutorId: string
): Promise<TareaResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    if (datos.parentId !== null) {
      await validarParent(tx, proyectoId, datos.parentId);
    }
    await validarAsignado(tx, proyectoId, datos.asignadoAId);

    let fechaCompletada = datos.fechaCompletada;
    if (datos.estado === EstadoTarea.COMPLETADA && fechaCompletada === null) {
      fechaCompletada = new Date();
    }
    validarFechaCompletada(datos.estado, fechaCompletada);
    validarFechas(datos.fechaInicio, datos.fechaVencimiento, fechaCompletada);

    const creada = await tx.proyectoTarea.create({
      data: {
        proyectoId,
        parentId: datos.parentId,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        estado: datos.estado,
        prioridad: datos.prioridad,
        asignadoAId: datos.asignadoAId,
        fechaInicio: datos.fechaInicio,
        fechaVencimiento: datos.fechaVencimiento,
        fechaCompletada,
        orden: datos.orden,
      },
      include: INCLUDE_TAREA,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'CREAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        tareaId: creada.id,
        parentId: datos.parentId,
        campos: [
          'titulo',
          'descripcion',
          'estado',
          'prioridad',
          'asignadoAId',
          'fechaInicio',
          'fechaVencimiento',
          'fechaCompletada',
          'orden',
        ],
      },
    });

    return creada;
  });

  return mapearTarea(fila);
};

export const actualizarTarea = async (
  proyectoId: number,
  tareaId: number,
  datos: DatosEdicionTarea,
  ejecutorId: string
): Promise<TareaResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const existente = await tx.proyectoTarea.findFirst({
      where: { id: tareaId, proyectoId, activo: true },
      include: INCLUDE_TAREA,
    });
    if (!existente) {
      throw new HttpError(404, 'Tarea no encontrada', [
        { campo: 'tareaId', valor: tareaId },
      ]);
    }

    const estadoFinal = datos.estado ?? existente.estado;
    const fechaInicio =
      datos.fechaInicio !== undefined ? datos.fechaInicio : existente.fechaInicio;
    const fechaVencimiento =
      datos.fechaVencimiento !== undefined
        ? datos.fechaVencimiento
        : existente.fechaVencimiento;
    let fechaCompletada =
      datos.fechaCompletada !== undefined
        ? datos.fechaCompletada
        : existente.fechaCompletada;

    if (estadoFinal === EstadoTarea.COMPLETADA && fechaCompletada === null) {
      fechaCompletada = new Date();
    }
    if (estadoFinal !== EstadoTarea.COMPLETADA) {
      fechaCompletada = null;
    }

    validarFechaCompletada(estadoFinal, fechaCompletada);
    validarFechas(fechaInicio, fechaVencimiento, fechaCompletada);

    if (datos.asignadoAId !== undefined) {
      await validarAsignado(tx, proyectoId, datos.asignadoAId);
    }

    const actualizada = await tx.proyectoTarea.update({
      where: { id: tareaId },
      data: {
        ...(datos.titulo !== undefined ? { titulo: datos.titulo } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion }
          : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        ...(datos.prioridad !== undefined
          ? { prioridad: datos.prioridad }
          : {}),
        ...(datos.asignadoAId !== undefined
          ? { asignadoAId: datos.asignadoAId }
          : {}),
        fechaInicio,
        fechaVencimiento,
        fechaCompletada,
        ...(datos.orden !== undefined ? { orden: datos.orden } : {}),
      },
      include: INCLUDE_TAREA,
    });

    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await registrarAuditoria(tx, {
        modulo: 'PROYECTOS',
        accion: 'ACTUALIZAR',
        entidadId: proyectoId,
        usuarioId: ejecutorId,
        detalle: {
          tareaId,
          campos,
        },
      });
    }

    return actualizada;
  });

  return mapearTarea(fila);
};

export const desactivarTarea = async (
  proyectoId: number,
  tareaId: number,
  ejecutorId: string
): Promise<TareaResumen> => {
  const existente = await prisma.proyectoTarea.findFirst({
    where: { id: tareaId, proyectoId },
    include: INCLUDE_TAREA,
  });
  if (!existente) {
    throw new HttpError(404, 'Tarea no encontrada', [
      { campo: 'tareaId', valor: tareaId },
    ]);
  }
  if (!existente.activo) return mapearTarea(existente);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const subtareas = await tx.proyectoTarea.updateMany({
      where: { proyectoId, parentId: tareaId, activo: true },
      data: { activo: false },
    });

    const actualizada = await tx.proyectoTarea.update({
      where: { id: tareaId },
      data: { activo: false },
      include: INCLUDE_TAREA,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'DESACTIVAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        tareaId,
        campos: ['activo'],
        subtareasDesactivadas: subtareas.count,
      },
    });

    return actualizada;
  });

  return mapearTarea(fila);
};
