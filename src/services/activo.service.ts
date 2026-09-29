import { Prisma, EstadoActivo } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { HttpError } from '../middlewares/error.middleware';
import {
  ActivoDetalle,
  ActivoResumen,
  DatosCreacionActivo,
  DatosEdicionActivo,
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

export const crear = async (datos: DatosCreacionActivo): Promise<ActivoDetalle> => {
  if (datos.responsableId) {
    const responsable = await prisma.usuario.findUnique({
      where: { id: datos.responsableId },
    });

    if (!responsable) {
      throw new HttpError(400, 'El usuario responsable no existe', [
        {
          campo: 'responsableId',
          valor: datos.responsableId,
          mensaje: 'El usuario responsable no existe',
        },
      ]);
    }
  }

  let fila: Prisma.ActivoGetPayload<{
    include: { responsable: typeof SELECT_USUARIO };
  }>;

  try {
    fila = await prisma.activo.create({
      data: {
        tipo: datos.tipo,
        claveActivo: datos.claveActivo,
        cb23: datos.cb23,
        marca: datos.marca,
        modelo: datos.modelo,
        numeroParte: datos.numeroParte,
        numeroSerie: datos.numeroSerie,
        sucursal: datos.sucursal,
        anydesk: datos.anydesk,
        nombreRed: datos.nombreRed,
        procesador: datos.procesador,
        memoria: datos.memoria,
        estadoGeneral: datos.estadoGeneral,
        notas: datos.notas,
        ...(datos.estado ? { estado: datos.estado } : {}),
        ...(datos.responsableId ? { responsableId: datos.responsableId } : {}),
      },
      include: { responsable: SELECT_USUARIO },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new HttpError(409, 'Ya existe un activo con esa clave', [
        { campo: 'claveActivo', valor: datos.claveActivo },
      ]);
    }

    throw error;
  }

  return {
    ...mapearResumen(fila),
    numeroParte: fila.numeroParte,
    anydesk: fila.anydesk,
    procesador: fila.procesador,
    memoria: fila.memoria,
    notas: fila.notas,
    asignaciones: [],
  };
};

export const actualizar = async (
  id: number,
  datos: DatosEdicionActivo
): Promise<ActivoDetalle> => {
  const existente = await prisma.activo.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existente) {
    throw new HttpError(404, 'Activo no encontrado', [
      { campo: 'id', valor: String(id) },
    ]);
  }

  if (datos.responsableId) {
    const responsable = await prisma.usuario.findUnique({
      where: { id: datos.responsableId },
    });

    if (!responsable) {
      throw new HttpError(400, 'El usuario responsable no existe', [
        {
          campo: 'responsableId',
          valor: datos.responsableId,
          mensaje: 'El usuario responsable no existe',
        },
      ]);
    }
  }

  const data: Prisma.ActivoUpdateInput = {
    ...(datos.tipo !== undefined ? { tipo: datos.tipo } : {}),
    ...(datos.claveActivo !== undefined ? { claveActivo: datos.claveActivo } : {}),
    ...(datos.cb23 !== undefined ? { cb23: datos.cb23 } : {}),
    ...(datos.marca !== undefined ? { marca: datos.marca } : {}),
    ...(datos.modelo !== undefined ? { modelo: datos.modelo } : {}),
    ...(datos.numeroParte !== undefined ? { numeroParte: datos.numeroParte } : {}),
    ...(datos.numeroSerie !== undefined ? { numeroSerie: datos.numeroSerie } : {}),
    ...(datos.sucursal !== undefined ? { sucursal: datos.sucursal } : {}),
    ...(datos.anydesk !== undefined ? { anydesk: datos.anydesk } : {}),
    ...(datos.nombreRed !== undefined ? { nombreRed: datos.nombreRed } : {}),
    ...(datos.procesador !== undefined ? { procesador: datos.procesador } : {}),
    ...(datos.memoria !== undefined ? { memoria: datos.memoria } : {}),
    ...(datos.estadoGeneral !== undefined ? { estadoGeneral: datos.estadoGeneral } : {}),
    ...(datos.notas !== undefined ? { notas: datos.notas } : {}),
    ...(datos.responsableId !== undefined
      ? { responsableId: datos.responsableId }
      : {}),
  };

  try {
    await prisma.activo.update({ where: { id }, data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new HttpError(409, 'Ya existe un activo con esa clave', [
        { campo: 'claveActivo', valor: datos.claveActivo ?? null },
      ]);
    }

    throw error;
  }

  return obtenerPorId(id);
};

export const cambiarEstado = async (
  id: number,
  estado: EstadoActivo
): Promise<ActivoDetalle> => {
  const fila = await prisma.activo.findUnique({
    where: { id },
    include: {
      asignaciones: {
        where: { activa: true },
        select: { id: true },
      },
    },
  });

  if (!fila) {
    throw new HttpError(404, 'Activo no encontrado', [
      { campo: 'id', valor: String(id) },
    ]);
  }

  const estadosQueExigenDevolucion: EstadoActivo[] = ['DE_BAJA', 'EN_ALMACEN'];

  if (
    fila.estado !== estado &&
    estadosQueExigenDevolucion.includes(estado) &&
    fila.asignaciones.length > 0
  ) {
    throw new HttpError(
      409,
      `El activo tiene una asignacion activa; devuelvelo antes de cambiar a ${estado}`,
      [
        { campo: 'estado', valor: estado },
        { campo: 'asignacionActiva', valor: String(fila.asignaciones[0].id) },
      ]
    );
  }

  if (fila.estado !== estado) {
    await prisma.activo.update({ where: { id }, data: { estado } });
  }

  return obtenerPorId(id);
};

export const ESTADOS_DE_ACTIVO: EstadoActivo[] = Object.values(EstadoActivo);
