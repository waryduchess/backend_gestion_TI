import { randomUUID } from 'node:crypto';
import {
  EstadoProyecto,
  Prisma,
  RolProyecto,
} from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionProyecto,
  DatosEdicionProyecto,
  DatosMiembroProyecto,
  ParametrosListadoProyectos,
  ProgresoProyecto,
  ProyectoDetalle,
  ProyectoMiembroResumen,
  ProyectoResumen,
  ResultadoListadoProyectos,
  ResumenHorasProyecto,
} from '../models/proyecto.model';
import { registrarAuditoria } from './auditoria.service';
import {
  filtroProyectosVisibles,
  puedeVerTodosProyectos,
} from '../utils/proyecto-visibilidad';
import { calcularResumenTareas } from '../utils/proyecto-progreso';

const INCLUDE_PROYECTO = {
  responsable: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
  departamento: {
    select: {
      id: true,
      nombre: true,
    },
  },
} as const;

type FilaProyecto = Prisma.ProyectoGetPayload<{
  include: typeof INCLUDE_PROYECTO;
}>;

const INCLUDE_MIEMBRO = {
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
} as const;

type FilaMiembro = Prisma.ProyectoMiembroGetPayload<{
  include: typeof INCLUDE_MIEMBRO;
}>;

const TRANSICIONES: Record<EstadoProyecto, EstadoProyecto[]> = {
  [EstadoProyecto.PLANIFICADO]: [
    EstadoProyecto.EN_PROGRESO,
    EstadoProyecto.CANCELADO,
  ],
  [EstadoProyecto.EN_PROGRESO]: [
    EstadoProyecto.PAUSADO,
    EstadoProyecto.COMPLETADO,
    EstadoProyecto.CANCELADO,
  ],
  [EstadoProyecto.PAUSADO]: [
    EstadoProyecto.EN_PROGRESO,
    EstadoProyecto.CANCELADO,
  ],
  [EstadoProyecto.COMPLETADO]: [],
  [EstadoProyecto.CANCELADO]: [],
};

const mapearMiembro = (fila: FilaMiembro): ProyectoMiembroResumen => ({
  proyectoId: fila.proyectoId,
  usuarioId: fila.usuarioId,
  rol: fila.rol,
  usuario: fila.usuario,
  createdAt: fila.createdAt,
});

const mapearProyecto = (fila: FilaProyecto): ProyectoResumen => ({
  id: fila.id,
  codigo: fila.codigo,
  nombre: fila.nombre,
  descripcion: fila.descripcion,
  estado: fila.estado,
  prioridad: fila.prioridad,
  fechaInicio: fila.fechaInicio,
  fechaFinPlanificada: fila.fechaFinPlanificada,
  fechaFinReal: fila.fechaFinReal,
  presupuesto: fila.presupuesto === null ? null : Number(fila.presupuesto),
  activo: fila.activo,
  responsable: fila.responsable,
  departamento: fila.departamento,
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const validarResponsable = async (
  cliente: Prisma.TransactionClient,
  responsableId: string
): Promise<void> => {
  const usuario = await cliente.usuario.findFirst({
    where: { id: responsableId, activo: true },
    select: { id: true },
  });
  if (!usuario) {
    throw new HttpError(
      400,
      'El responsable no existe o esta inactivo',
      [{ campo: 'responsableId', valor: responsableId }]
    );
  }
};

const validarDepartamento = async (
  cliente: Prisma.TransactionClient,
  departamentoId: number | null
): Promise<void> => {
  if (departamentoId === null) return;
  const departamento = await cliente.departamento.findFirst({
    where: { id: departamentoId, activo: true },
    select: { id: true },
  });
  if (!departamento) {
    throw new HttpError(
      400,
      'El departamento no existe o esta inactivo',
      [{ campo: 'departamentoId', valor: departamentoId }]
    );
  }
};

const validarFechas = (
  fechaInicio: Date,
  fechaFinPlanificada: Date,
  fechaFinReal: Date | null
): void => {
  if (fechaFinPlanificada.getTime() < fechaInicio.getTime()) {
    throw new HttpError(
      400,
      '"fechaFinPlanificada" no puede ser anterior a "fechaInicio"',
      [
        {
          campo: 'fechaFinPlanificada',
          valor: fechaFinPlanificada.toISOString().slice(0, 10),
        },
      ]
    );
  }
  if (fechaFinReal && fechaFinReal.getTime() < fechaInicio.getTime()) {
    throw new HttpError(
      400,
      '"fechaFinReal" no puede ser anterior a "fechaInicio"',
      [
        {
          campo: 'fechaFinReal',
          valor: fechaFinReal.toISOString().slice(0, 10),
        },
      ]
    );
  }
};

const validarFechaRealEstado = (
  estado: EstadoProyecto,
  fechaFinReal: Date | null
): void => {
  if (fechaFinReal !== null && estado !== EstadoProyecto.COMPLETADO) {
    throw new HttpError(
      400,
      '"fechaFinReal" solo se permite cuando el estado es COMPLETADO',
      [{ campo: 'fechaFinReal', valor: fechaFinReal.toISOString() }]
    );
  }
};

const validarTransicion = (
  estadoActual: EstadoProyecto,
  estadoDestino: EstadoProyecto
): void => {
  if (!TRANSICIONES[estadoActual].includes(estadoDestino)) {
    throw new HttpError(
      400,
      `No se puede cambiar el estado de ${estadoActual} a ${estadoDestino}`,
      [
        {
          campo: 'estado',
          valor: estadoDestino,
          permitidos: TRANSICIONES[estadoActual],
        },
      ]
    );
  }
};

export const listarProyectos = async (
  parametros: ParametrosListadoProyectos
): Promise<ResultadoListadoProyectos> => {
  const verTodos = await puedeVerTodosProyectos(parametros.usuarioId);
  if (!verTodos && parametros.activo === false) {
    return {
      proyectos: [],
      meta: {
        page: parametros.page,
        limit: parametros.limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const where: Prisma.ProyectoWhereInput = {
    ...filtroProyectosVisibles(parametros.usuarioId, verTodos),
    ...(verTodos
      ? parametros.activo !== undefined
        ? { activo: parametros.activo }
        : {}
      : { activo: true }),
    ...(parametros.estado ? { estado: parametros.estado } : {}),
    ...(parametros.prioridad ? { prioridad: parametros.prioridad } : {}),
    ...(parametros.responsableId
      ? { responsableId: parametros.responsableId }
      : {}),
    ...(parametros.departamentoId
      ? { departamentoId: parametros.departamentoId }
      : {}),
    ...(parametros.q
      ? {
          OR: [
            { codigo: { contains: parametros.q } },
            { nombre: { contains: parametros.q } },
            { descripcion: { contains: parametros.q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.proyecto.findMany({
      where,
      include: INCLUDE_PROYECTO,
      orderBy: [{ fechaFinPlanificada: 'asc' }, { id: 'asc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.proyecto.count({ where }),
  ]);

  return {
    proyectos: filas.map(mapearProyecto),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerProyecto = async (id: number): Promise<ProyectoResumen> => {
  const fila = await prisma.proyecto.findFirst({
    where: { id, activo: true },
    include: INCLUDE_PROYECTO,
  });
  if (!fila) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  return mapearProyecto(fila);
};

export const listarMiembros = async (
  proyectoId: number
): Promise<ProyectoMiembroResumen[]> => {
  const proyecto = await prisma.proyecto.findFirst({
    where: { id: proyectoId, activo: true },
    select: { id: true },
  });
  if (!proyecto) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: proyectoId },
    ]);
  }

  const filas = await prisma.proyectoMiembro.findMany({
    where: { proyectoId },
    include: INCLUDE_MIEMBRO,
    orderBy: { createdAt: 'asc' },
  });
  return filas.map(mapearMiembro);
};

const calcularProgresoProyecto = async (
  proyectoId: number
): Promise<ProgresoProyecto> => {
  const tareas = await prisma.proyectoTarea.findMany({
    where: { proyectoId, activo: true, parentId: null },
    select: {
      estado: true,
      subtareas: {
        where: { activo: true },
        select: { estado: true },
      },
    },
  });

  return calcularResumenTareas(tareas);
};

const calcularResumenHoras = async (
  proyectoId: number
): Promise<ResumenHorasProyecto> => {
  const resultado = await prisma.proyectoRegistroHoras.aggregate({
    where: { proyectoId, activo: true },
    _sum: { horas: true },
    _count: { _all: true },
  });

  return {
    totalHoras:
      resultado._sum.horas === null ? 0 : Number(resultado._sum.horas),
    totalRegistros: resultado._count._all,
  };
};

export const obtenerProyectoDetalle = async (
  id: number
): Promise<ProyectoDetalle> => {
  const proyecto = await obtenerProyecto(id);
  return {
    ...proyecto,
    ...(await calcularProgresoProyecto(id)),
    miembros: await listarMiembros(id),
    resumenHoras: await calcularResumenHoras(id),
  };
};

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

export const agregarMiembro = async (
  proyectoId: number,
  datos: DatosMiembroProyecto,
  ejecutorId: string
): Promise<ProyectoMiembroResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const usuario = await tx.usuario.findFirst({
      where: { id: datos.usuarioId, activo: true },
      select: { id: true },
    });
    if (!usuario) {
      throw new HttpError(400, 'El usuario no existe o esta inactivo', [
        { campo: 'usuarioId', valor: datos.usuarioId },
      ]);
    }

    const existente = await tx.proyectoMiembro.findUnique({
      where: {
        proyectoId_usuarioId: {
          proyectoId,
          usuarioId: datos.usuarioId,
        },
      },
      select: { usuarioId: true },
    });
    if (existente) {
      throw new HttpError(409, 'El usuario ya es miembro del proyecto', [
        { campo: 'usuarioId', valor: datos.usuarioId },
      ]);
    }

    const creado = await tx.proyectoMiembro.create({
      data: {
        proyectoId,
        usuarioId: datos.usuarioId,
        rol: datos.rol,
      },
      include: INCLUDE_MIEMBRO,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'ASIGNAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        campos: ['usuarioId', 'rol'],
        usuarioId: datos.usuarioId,
        rol: datos.rol,
      },
    });

    return creado;
  });

  return mapearMiembro(fila);
};

export const actualizarMiembro = async (
  proyectoId: number,
  usuarioId: string,
  rol: DatosMiembroProyecto['rol'],
  ejecutorId: string
): Promise<ProyectoMiembroResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const existente = await tx.proyectoMiembro.findUnique({
      where: {
        proyectoId_usuarioId: { proyectoId, usuarioId },
      },
      select: { usuarioId: true },
    });
    if (!existente) {
      throw new HttpError(404, 'Miembro del proyecto no encontrado', [
        { campo: 'usuarioId', valor: usuarioId },
      ]);
    }

    const actualizado = await tx.proyectoMiembro.update({
      where: {
        proyectoId_usuarioId: { proyectoId, usuarioId },
      },
      data: { rol },
      include: INCLUDE_MIEMBRO,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'ACTUALIZAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        campos: ['rol'],
        usuarioId,
        rol,
      },
    });

    return actualizado;
  });

  return mapearMiembro(fila);
};

export const eliminarMiembro = async (
  proyectoId: number,
  usuarioId: string,
  ejecutorId: string
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const existente = await tx.proyectoMiembro.findUnique({
      where: {
        proyectoId_usuarioId: { proyectoId, usuarioId },
      },
      select: { usuarioId: true },
    });
    if (!existente) {
      throw new HttpError(404, 'Miembro del proyecto no encontrado', [
        { campo: 'usuarioId', valor: usuarioId },
      ]);
    }

    await tx.proyectoMiembro.delete({
      where: {
        proyectoId_usuarioId: { proyectoId, usuarioId },
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'ELIMINAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        campos: ['usuarioId'],
        usuarioId,
      },
    });
  });
};

export const crearProyecto = async (
  datos: DatosCreacionProyecto,
  ejecutorId: string
): Promise<ProyectoResumen> => {
  const fechaFinReal =
    datos.estado === EstadoProyecto.COMPLETADO
      ? datos.fechaFinReal ?? new Date()
      : datos.fechaFinReal;

  validarFechaRealEstado(datos.estado, fechaFinReal);
  validarFechas(datos.fechaInicio, datos.fechaFinPlanificada, fechaFinReal);

  const fila = await prisma.$transaction(async (tx) => {
    await validarResponsable(tx, datos.responsableId);
    await validarDepartamento(tx, datos.departamentoId);

    const creado = await tx.proyecto.create({
      data: {
        codigo: `TMP-${randomUUID().slice(0, 8)}`,
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        estado: datos.estado,
        prioridad: datos.prioridad,
        fechaInicio: datos.fechaInicio,
        fechaFinPlanificada: datos.fechaFinPlanificada,
        fechaFinReal,
        presupuesto: datos.presupuesto,
        responsableId: datos.responsableId,
        departamentoId: datos.departamentoId,
      },
      select: { id: true },
    });

    const actualizado = await tx.proyecto.update({
      where: { id: creado.id },
      data: { codigo: `PRY-${String(creado.id).padStart(4, '0')}` },
      include: INCLUDE_PROYECTO,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'CREAR',
      entidadId: actualizado.id,
      usuarioId: ejecutorId,
      detalle: {
        campos: [
          'codigo',
          'nombre',
          'descripcion',
          'estado',
          'prioridad',
          'fechaInicio',
          'fechaFinPlanificada',
          'fechaFinReal',
          'presupuesto',
          'responsableId',
          'departamentoId',
        ],
      },
    });

    const verTodos = await puedeVerTodosProyectos(ejecutorId);
    if (!verTodos && datos.responsableId !== ejecutorId) {
      await tx.proyectoMiembro.create({
        data: {
          proyectoId: actualizado.id,
          usuarioId: ejecutorId,
          rol: RolProyecto.LIDER,
        },
      });
      await registrarAuditoria(tx, {
        modulo: 'PROYECTOS',
        accion: 'ASIGNAR',
        entidadId: actualizado.id,
        usuarioId: ejecutorId,
        detalle: {
          campos: ['usuarioId', 'rol'],
          usuarioId: ejecutorId,
          rol: 'LIDER',
        },
      });
    }

    return actualizado;
  });

  return mapearProyecto(fila);
};

export const actualizarProyecto = async (
  id: number,
  datos: DatosEdicionProyecto,
  ejecutorId: string
): Promise<ProyectoResumen> => {
  const fila = await prisma.$transaction(async (tx) => {
    const existente = await tx.proyecto.findUnique({
      where: { id },
      include: INCLUDE_PROYECTO,
    });
    if (!existente || (!existente.activo && datos.activo !== true)) {
      throw new HttpError(404, 'Proyecto no encontrado', [
        { campo: 'id', valor: id },
      ]);
    }

    if (
      datos.estado !== undefined &&
      datos.estado !== existente.estado
    ) {
      validarTransicion(existente.estado, datos.estado);
    }

    const estadoFinal = datos.estado ?? existente.estado;
    const fechaInicio = datos.fechaInicio ?? existente.fechaInicio;
    const fechaFinPlanificada =
      datos.fechaFinPlanificada ?? existente.fechaFinPlanificada;
    let fechaFinReal =
      datos.fechaFinReal !== undefined
        ? datos.fechaFinReal
        : existente.fechaFinReal;

    if (estadoFinal === EstadoProyecto.COMPLETADO && fechaFinReal === null) {
      fechaFinReal = new Date();
    }

    validarFechaRealEstado(estadoFinal, fechaFinReal);
    validarFechas(fechaInicio, fechaFinPlanificada, fechaFinReal);

    if (datos.responsableId !== undefined) {
      await validarResponsable(tx, datos.responsableId);
    }
    if (datos.departamentoId !== undefined) {
      await validarDepartamento(tx, datos.departamentoId);
    }

    const data: Prisma.ProyectoUncheckedUpdateInput = {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
      ...(datos.descripcion !== undefined
        ? { descripcion: datos.descripcion }
        : {}),
      ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
      ...(datos.prioridad !== undefined
        ? { prioridad: datos.prioridad }
        : {}),
      ...(datos.fechaInicio !== undefined
        ? { fechaInicio: datos.fechaInicio }
        : {}),
      ...(datos.fechaFinPlanificada !== undefined
        ? { fechaFinPlanificada: datos.fechaFinPlanificada }
        : {}),
      ...(datos.presupuesto !== undefined
        ? { presupuesto: datos.presupuesto }
        : {}),
      ...(datos.fechaFinReal !== undefined ||
      (estadoFinal === EstadoProyecto.COMPLETADO &&
        existente.fechaFinReal === null)
        ? { fechaFinReal }
        : {}),
      ...(datos.responsableId !== undefined
        ? { responsableId: datos.responsableId }
        : {}),
      ...(datos.departamentoId !== undefined
        ? { departamentoId: datos.departamentoId }
        : {}),
      ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
    };

    const actualizado = await tx.proyecto.update({
      where: { id },
      data,
      include: INCLUDE_PROYECTO,
    });

    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await registrarAuditoria(tx, {
        modulo: 'PROYECTOS',
        accion: 'ACTUALIZAR',
        entidadId: actualizado.id,
        usuarioId: ejecutorId,
        detalle: { campos },
      });
    }

    return actualizado;
  });

  return mapearProyecto(fila);
};

export const desactivarProyecto = async (
  id: number,
  ejecutorId: string
): Promise<ProyectoResumen> => {
  const existente = await prisma.proyecto.findUnique({
    where: { id },
    include: INCLUDE_PROYECTO,
  });
  if (!existente) {
    throw new HttpError(404, 'Proyecto no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  if (!existente.activo) return mapearProyecto(existente);

  const fila = await prisma.$transaction(async (tx) => {
    const actualizado = await tx.proyecto.update({
      where: { id },
      data: { activo: false },
      include: INCLUDE_PROYECTO,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'DESACTIVAR',
      entidadId: actualizado.id,
      usuarioId: ejecutorId,
      detalle: { campos: ['activo'] },
    });

    return actualizado;
  });

  return mapearProyecto(fila);
};
