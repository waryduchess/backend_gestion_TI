import { Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionHoras,
  DatosEdicionHoras,
  ParametrosListadoHoras,
  RegistroHorasResumen,
  ResultadoListadoHoras,
} from '../models/proyecto-horas.model';
import { registrarAuditoria } from './auditoria.service';

const INCLUDE_REGISTRO_HORAS = {
  usuario: {
    select: {
      id: true,
      nombre: true,
      email: true,
    },
  },
  tarea: {
    select: {
      id: true,
      titulo: true,
    },
  },
} as const;

type FilaRegistroHoras = Prisma.ProyectoRegistroHorasGetPayload<{
  include: typeof INCLUDE_REGISTRO_HORAS;
}>;

const mapearRegistro = (
  fila: FilaRegistroHoras
): RegistroHorasResumen => ({
  id: fila.id,
  proyectoId: fila.proyectoId,
  tareaId: fila.tareaId,
  tarea: fila.tarea,
  usuarioId: fila.usuarioId,
  usuario: fila.usuario,
  fecha: fila.fecha,
  horas: Number(fila.horas),
  descripcion: fila.descripcion,
  activo: fila.activo,
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

const verificarProyectoParaLectura = async (
  proyectoId: number
): Promise<void> => {
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

const validarUsuarioProyecto = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  usuarioId: string
): Promise<void> => {
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
    where: { id: usuarioId, activo: true },
    select: { id: true },
  });
  if (!usuario) {
    throw new HttpError(400, 'El usuario no existe o esta inactivo', [
      { campo: 'usuarioId', valor: usuarioId },
    ]);
  }

  if (proyecto.responsableId === usuarioId) return;

  const miembro = await cliente.proyectoMiembro.findUnique({
    where: {
      proyectoId_usuarioId: { proyectoId, usuarioId },
    },
    select: { usuarioId: true },
  });
  if (!miembro) {
    throw new HttpError(
      400,
      'El usuario no pertenece al proyecto',
      [{ campo: 'usuarioId', valor: usuarioId }]
    );
  }
};

const validarTareaProyecto = async (
  cliente: Prisma.TransactionClient,
  proyectoId: number,
  tareaId: number
): Promise<void> => {
  const tarea = await cliente.proyectoTarea.findFirst({
    where: { id: tareaId, proyectoId, activo: true },
    select: { id: true },
  });
  if (!tarea) {
    throw new HttpError(404, 'Tarea no encontrada en el proyecto', [
      { campo: 'tareaId', valor: tareaId },
    ]);
  }
};

const validarHoras = (horas: number): void => {
  if (
    typeof horas !== 'number' ||
    !Number.isFinite(horas) ||
    horas <= 0 ||
    horas > 24
  ) {
    throw new HttpError(
      400,
      'El campo "horas" debe ser mayor a cero y menor o igual a 24',
      [{ campo: 'horas', valor: horas }]
    );
  }
};

export const listarHoras = async (
  proyectoId: number,
  parametros: ParametrosListadoHoras
): Promise<ResultadoListadoHoras> => {
  await verificarProyectoParaLectura(proyectoId);

  const where: Prisma.ProyectoRegistroHorasWhereInput = {
    proyectoId,
    activo: true,
    ...(parametros.tareaId ? { tareaId: parametros.tareaId } : {}),
    ...(parametros.usuarioId ? { usuarioId: parametros.usuarioId } : {}),
    ...(parametros.desde || parametros.hasta
      ? {
          fecha: {
            ...(parametros.desde ? { gte: parametros.desde } : {}),
            ...(parametros.hasta ? { lte: parametros.hasta } : {}),
          },
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.proyectoRegistroHoras.findMany({
      where,
      include: INCLUDE_REGISTRO_HORAS,
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.proyectoRegistroHoras.count({ where }),
  ]);

  return {
    registros: filas.map(mapearRegistro),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

export const obtenerRegistroHoras = async (
  proyectoId: number,
  registroId: number
): Promise<RegistroHorasResumen> => {
  await verificarProyectoParaLectura(proyectoId);

  const fila = await prisma.proyectoRegistroHoras.findFirst({
    where: { id: registroId, proyectoId, activo: true },
    include: INCLUDE_REGISTRO_HORAS,
  });
  if (!fila) {
    throw new HttpError(404, 'Registro de horas no encontrado', [
      { campo: 'registroId', valor: registroId },
    ]);
  }
  return mapearRegistro(fila);
};

export const crearRegistroHoras = async (
  proyectoId: number,
  datos: DatosCreacionHoras,
  ejecutorId: string
): Promise<RegistroHorasResumen> => {
  validarHoras(datos.horas);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);
    await validarUsuarioProyecto(tx, proyectoId, datos.usuarioId);
    if (datos.tareaId !== null) {
      await validarTareaProyecto(tx, proyectoId, datos.tareaId);
    }

    const creado = await tx.proyectoRegistroHoras.create({
      data: {
        proyectoId,
        tareaId: datos.tareaId,
        usuarioId: datos.usuarioId,
        fecha: datos.fecha,
        horas: datos.horas,
        descripcion: datos.descripcion,
      },
      include: INCLUDE_REGISTRO_HORAS,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'CREAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: {
        registroHorasId: creado.id,
        campos: ['tareaId', 'usuarioId', 'fecha', 'horas', 'descripcion'],
      },
    });

    return creado;
  });

  return mapearRegistro(fila);
};

export const actualizarRegistroHoras = async (
  proyectoId: number,
  registroId: number,
  datos: DatosEdicionHoras,
  ejecutorId: string
): Promise<RegistroHorasResumen> => {
  if (datos.horas !== undefined) validarHoras(datos.horas);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const existente = await tx.proyectoRegistroHoras.findFirst({
      where: { id: registroId, proyectoId, activo: true },
      include: INCLUDE_REGISTRO_HORAS,
    });
    if (!existente) {
      throw new HttpError(404, 'Registro de horas no encontrado', [
        { campo: 'registroId', valor: registroId },
      ]);
    }

    if (datos.usuarioId !== undefined) {
      await validarUsuarioProyecto(tx, proyectoId, datos.usuarioId);
    }
    const tareaId =
      datos.tareaId !== undefined ? datos.tareaId : existente.tareaId;
    if (tareaId !== null) {
      await validarTareaProyecto(tx, proyectoId, tareaId);
    }

    const actualizado = await tx.proyectoRegistroHoras.update({
      where: { id: registroId },
      data: {
        ...(datos.tareaId !== undefined ? { tareaId: datos.tareaId } : {}),
        ...(datos.usuarioId !== undefined
          ? { usuarioId: datos.usuarioId }
          : {}),
        ...(datos.fecha !== undefined ? { fecha: datos.fecha } : {}),
        ...(datos.horas !== undefined ? { horas: datos.horas } : {}),
        ...(datos.descripcion !== undefined
          ? { descripcion: datos.descripcion }
          : {}),
      },
      include: INCLUDE_REGISTRO_HORAS,
    });

    const campos = Object.keys(datos);
    if (campos.length > 0) {
      await registrarAuditoria(tx, {
        modulo: 'PROYECTOS',
        accion: 'ACTUALIZAR',
        entidadId: proyectoId,
        usuarioId: ejecutorId,
        detalle: { registroHorasId: registroId, campos },
      });
    }

    return actualizado;
  });

  return mapearRegistro(fila);
};

export const desactivarRegistroHoras = async (
  proyectoId: number,
  registroId: number,
  ejecutorId: string
): Promise<RegistroHorasResumen> => {
  const existente = await prisma.proyectoRegistroHoras.findFirst({
    where: { id: registroId, proyectoId },
    include: INCLUDE_REGISTRO_HORAS,
  });
  if (!existente) {
    throw new HttpError(404, 'Registro de horas no encontrado', [
      { campo: 'registroId', valor: registroId },
    ]);
  }
  if (!existente.activo) return mapearRegistro(existente);

  const fila = await prisma.$transaction(async (tx) => {
    await verificarProyectoActivo(tx, proyectoId);

    const actualizado = await tx.proyectoRegistroHoras.update({
      where: { id: registroId },
      data: { activo: false },
      include: INCLUDE_REGISTRO_HORAS,
    });

    await registrarAuditoria(tx, {
      modulo: 'PROYECTOS',
      accion: 'DESACTIVAR',
      entidadId: proyectoId,
      usuarioId: ejecutorId,
      detalle: { registroHorasId: registroId, campos: ['activo'] },
    });

    return actualizado;
  });

  return mapearRegistro(fila);
};
