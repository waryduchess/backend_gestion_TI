import {
  EstadoIncidencia,
  Prioridad,
  Prisma,
  TipoRequerimiento,
} from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import { HttpError } from '../../../middlewares/error.middleware';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import {
  comoEntero,
  comoFecha,
  validarOpcion,
} from '../../../utils/validacion';

const MAX_FILAS = 10000;
const MILISEGUNDOS_POR_HORA = 60 * 60 * 1000;
const MILISEGUNDOS_POR_DIA = 24 * MILISEGUNDOS_POR_HORA;

const textoOpcional = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
};

const leerFechaLimite = (
  valor: unknown,
  campo: string,
  finDia: boolean
): Date | undefined => {
  if (valor === undefined) return undefined;
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto === '') return undefined;
  const fecha = comoFecha(texto, campo);
  if (!fecha) return undefined;
  if (finDia && /^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return new Date(fecha.getTime() + MILISEGUNDOS_POR_DIA - 1);
  }
  return fecha;
};

const validarFiltros = (
  query: Record<string, unknown>
): Record<string, unknown> => {
  const ahora = new Date();
  const inicioMes = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1)
  );
  const finMes = new Date(
    Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );

  const desde = leerFechaLimite(query.desde, 'desde', false) ?? inicioMes;
  const hasta = leerFechaLimite(query.hasta, 'hasta', true) ?? finMes;
  if (desde.getTime() > hasta.getTime()) {
    throw new HttpError(400, '"desde" no puede ser posterior a "hasta"', [
      { campo: 'desde', valor: desde.toISOString() },
      { campo: 'hasta', valor: hasta.toISOString() },
    ]);
  }

  const estado = validarOpcion(
    query.estado,
    'estado',
    Object.values(EstadoIncidencia)
  ) as EstadoIncidencia | undefined;
  const prioridad = validarOpcion(
    query.prioridad,
    'prioridad',
    Object.values(Prioridad)
  ) as Prioridad | undefined;
  const tipoRequerimiento = validarOpcion(
    query.tipoRequerimiento,
    'tipoRequerimiento',
    Object.values(TipoRequerimiento)
  ) as TipoRequerimiento | undefined;

  const departamentoId = comoEntero(query.departamentoId, 'departamentoId', 0);
  if (departamentoId < 0) {
    throw new HttpError(
      400,
      'El parámetro "departamentoId" debe ser positivo',
      [{ campo: 'departamentoId', valor: String(departamentoId) }]
    );
  }

  return {
    desde,
    hasta,
    estado,
    prioridad,
    tipoRequerimiento,
    departamentoId: departamentoId > 0 ? departamentoId : undefined,
    solicitanteId: textoOpcional(query.solicitanteId),
    asignadoAId: textoOpcional(query.asignadoAId),
    q: textoOpcional(query.q),
  };
};

const cargarIncidencias = async (
  filtros: Record<string, unknown>
): Promise<ReporteDocumento> => {
  const desde = filtros.desde as Date;
  const hasta = filtros.hasta as Date;
  const estado = filtros.estado as EstadoIncidencia | undefined;
  const prioridad = filtros.prioridad as Prioridad | undefined;
  const tipoRequerimiento = filtros.tipoRequerimiento as
    | TipoRequerimiento
    | undefined;
  const departamentoId = filtros.departamentoId as number | undefined;
  const solicitanteId = filtros.solicitanteId as string | undefined;
  const asignadoAId = filtros.asignadoAId as string | undefined;
  const q = filtros.q as string | undefined;

  const where: Prisma.IncidenciaWhereInput = {
    fechaNotificacion: { gte: desde, lte: hasta },
    ...(estado ? { estado } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(tipoRequerimiento ? { tipoRequerimiento } : {}),
    ...(departamentoId ? { departamentoId } : {}),
    ...(solicitanteId ? { solicitanteId } : {}),
    ...(asignadoAId ? { asignadoAId } : {}),
    ...(q
      ? {
          OR: [
            { titulo: { contains: q } },
            { descripcion: { contains: q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.incidencia.findMany({
      where,
      orderBy: [{ fechaNotificacion: 'desc' }, { id: 'desc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        titulo: true,
        estado: true,
        prioridad: true,
        tipoRequerimiento: true,
        fechaNotificacion: true,
        fechaResolucion: true,
        solicitante: {
          select: { id: true, nombre: true, email: true },
        },
        asignadoA: {
          select: { id: true, nombre: true, email: true },
        },
        departamento: {
          select: { id: true, nombre: true },
        },
        _count: { select: { actualizaciones: true } },
      },
    }),
    prisma.incidencia.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  const resumenEstado = new Map<
    EstadoIncidencia,
    { cantidad: number; resueltas: number; tiempoTotalHoras: number }
  >();
  const resumenPrioridad = new Map<Prioridad, number>();
  const resumenTipo = new Map<TipoRequerimiento, number>();
  let completadas = 0;
  let pendientes = 0;
  let duplicadas = 0;
  let resoluciones = 0;
  let tiempoTotalHoras = 0;

  const detalle = filas.map((fila) => {
    const tiempoHoras =
      fila.fechaResolucion === null
        ? null
        : Math.max(
            0,
            Math.round(
              ((fila.fechaResolucion.getTime() -
                fila.fechaNotificacion.getTime()) /
                MILISEGUNDOS_POR_HORA) *
                100
            ) / 100
          );

    if (tiempoHoras !== null) {
      resoluciones += 1;
      tiempoTotalHoras += tiempoHoras;
    }
    if (fila.estado === EstadoIncidencia.COMPLETADO) completadas += 1;
    else if (fila.estado === EstadoIncidencia.DUPLICADO) duplicadas += 1;
    else pendientes += 1;

    const porEstado = resumenEstado.get(fila.estado) ?? {
      cantidad: 0,
      resueltas: 0,
      tiempoTotalHoras: 0,
    };
    porEstado.cantidad += 1;
    if (tiempoHoras !== null) {
      porEstado.resueltas += 1;
      porEstado.tiempoTotalHoras += tiempoHoras;
    }
    resumenEstado.set(fila.estado, porEstado);

    resumenPrioridad.set(
      fila.prioridad,
      (resumenPrioridad.get(fila.prioridad) ?? 0) + 1
    );
    resumenTipo.set(
      fila.tipoRequerimiento,
      (resumenTipo.get(fila.tipoRequerimiento) ?? 0) + 1
    );

    return {
      id: fila.id,
      titulo: fila.titulo,
      estado: fila.estado,
      prioridad: fila.prioridad,
      tipoRequerimiento: fila.tipoRequerimiento,
      fechaNotificacion: fila.fechaNotificacion,
      fechaResolucion: fila.fechaResolucion,
      tiempoResolucionHoras: tiempoHoras,
      solicitante: fila.solicitante.nombre,
      asignadoA: fila.asignadoA?.nombre ?? null,
      departamento: fila.departamento?.nombre ?? null,
      actualizaciones: fila._count.actualizaciones,
    };
  });

  return {
    titulo: 'Reporte de incidencias por periodo',
    subtitulo: `Total de registros: ${total}`,
    generadoEn: new Date(),
    generadoPor: 'Sistema',
    metadatos: {
      'Periodo desde': desde.toISOString(),
      'Periodo hasta': hasta.toISOString(),
      Estado: estado ?? 'Todos',
      Prioridad: prioridad ?? 'Todas',
      'Tipo de requerimiento': tipoRequerimiento ?? 'Todos',
      Departamento: departamentoId ? String(departamentoId) : 'Todos',
      Solicitante: solicitanteId ?? 'Todos',
      Asignado: asignadoAId ?? 'Todos',
      Búsqueda: q ?? 'Sin búsqueda',
      'Tiempo promedio de resolución (h)':
        resoluciones === 0
          ? '0'
          : (tiempoTotalHoras / resoluciones).toFixed(2),
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Resumen',
        columnas: [
          { clave: 'total', encabezado: 'Total', ancho: 12 },
          { clave: 'completadas', encabezado: 'Completadas', ancho: 14 },
          { clave: 'pendientes', encabezado: 'Pendientes', ancho: 14 },
          { clave: 'duplicadas', encabezado: 'Duplicadas', ancho: 14 },
          { clave: 'tiempoPromedioHoras', encabezado: 'Tiempo promedio (h)', ancho: 20 },
        ],
        filas: [
          {
            total,
            completadas,
            pendientes,
            duplicadas,
            tiempoPromedioHoras:
              resoluciones === 0
                ? 0
                : Math.round((tiempoTotalHoras / resoluciones) * 100) / 100,
          },
        ],
      },
      {
        nombre: 'Resumen por estado',
        columnas: [
          { clave: 'estado', encabezado: 'Estado', ancho: 20 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
          { clave: 'resueltas', encabezado: 'Con resolución', ancho: 16 },
          { clave: 'tiempoPromedioHoras', encabezado: 'Tiempo promedio (h)', ancho: 20 },
        ],
        filas: [...resumenEstado.entries()].map(([estadoFila, datos]) => ({
          estado: estadoFila,
          cantidad: datos.cantidad,
          resueltas: datos.resueltas,
          tiempoPromedioHoras:
            datos.resueltas === 0
              ? 0
              : Math.round((datos.tiempoTotalHoras / datos.resueltas) * 100) /
                100,
        })),
        totales: { cantidad: total },
      },
      {
        nombre: 'Resumen por prioridad',
        columnas: [
          { clave: 'prioridad', encabezado: 'Prioridad', ancho: 18 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenPrioridad.entries()].map(([prioridadFila, cantidad]) => ({
          prioridad: prioridadFila,
          cantidad,
        })),
        totales: { cantidad: total },
      },
      {
        nombre: 'Resumen por tipo',
        columnas: [
          { clave: 'tipoRequerimiento', encabezado: 'Tipo de requerimiento', ancho: 28 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenTipo.entries()].map(([tipoFila, cantidad]) => ({
          tipoRequerimiento: tipoFila,
          cantidad,
        })),
        totales: { cantidad: total },
      },
      {
        nombre: 'Detalle de incidencias',
        columnas: [
          { clave: 'id', encabezado: 'ID', ancho: 8 },
          { clave: 'titulo', encabezado: 'Título', ancho: 40 },
          { clave: 'estado', encabezado: 'Estado', ancho: 18 },
          { clave: 'prioridad', encabezado: 'Prioridad', ancho: 14 },
          { clave: 'tipoRequerimiento', encabezado: 'Tipo', ancho: 24 },
          { clave: 'fechaNotificacion', encabezado: 'Fecha de notificación', ancho: 20 },
          { clave: 'fechaResolucion', encabezado: 'Fecha de resolución', ancho: 20 },
          { clave: 'tiempoResolucionHoras', encabezado: 'Tiempo de resolución (h)', ancho: 22 },
          { clave: 'solicitante', encabezado: 'Solicitante', ancho: 28 },
          { clave: 'asignadoA', encabezado: 'Asignado a', ancho: 28 },
          { clave: 'departamento', encabezado: 'Departamento', ancho: 22 },
          { clave: 'actualizaciones', encabezado: 'Actualizaciones', ancho: 16 },
        ],
        filas: detalle,
      },
    ],
  };
};

export const incidenciasPeriodoReporte: ReporteDefinicion = {
  codigo: 'incidencias-periodo',
  nombre: 'Incidencias por periodo',
  descripcion:
    'Incidencias por rango de fecha de notificación, con resúmenes por estado, prioridad y tipo, y tiempo de resolución.',
  modulo: 'Incidencias',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['incidencias:leer'],
  filtros: [
    {
      nombre: 'desde',
      tipo: 'fecha',
      descripcion: 'Fecha inicial inclusive. Default: inicio del mes actual.',
    },
    {
      nombre: 'hasta',
      tipo: 'fecha',
      descripcion: 'Fecha final inclusive. Default: fin del mes actual.',
    },
    {
      nombre: 'estado',
      tipo: 'enum',
      descripcion: 'Estado de la incidencia.',
      opciones: Object.values(EstadoIncidencia),
    },
    {
      nombre: 'prioridad',
      tipo: 'enum',
      descripcion: 'Prioridad de la incidencia.',
      opciones: Object.values(Prioridad),
    },
    {
      nombre: 'tipoRequerimiento',
      tipo: 'enum',
      descripcion: 'Tipo de requerimiento.',
      opciones: Object.values(TipoRequerimiento),
    },
    {
      nombre: 'departamentoId',
      tipo: 'texto',
      descripcion: 'ID del departamento.',
    },
    {
      nombre: 'solicitanteId',
      tipo: 'texto',
      descripcion: 'ID del solicitante.',
    },
    {
      nombre: 'asignadoAId',
      tipo: 'texto',
      descripcion: 'ID del usuario asignado.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en título o descripción.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarIncidencias,
};
