import {
  EstadoActivo,
  EstadoHito,
  EstadoIncidencia,
  EstadoProyecto,
  MantenimientoEstado,
  Prisma,
} from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import { HttpError } from '../../../middlewares/error.middleware';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import {
  filtroProyectosVisibles,
  puedeVerTodosProyectos,
} from '../../../utils/proyecto-visibilidad';
import { comoFecha } from '../../../utils/validacion';

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

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

  return { desde, hasta };
};

const cargarEjecutivo = async (
  filtros: Record<string, unknown>,
  usuario: { id: string; nombre: string; email: string | null }
): Promise<ReporteDocumento> => {
  const desde = filtros.desde as Date;
  const hasta = filtros.hasta as Date;
  const ahora = new Date();
  const en30Dias = new Date(ahora.getTime() + 30 * MILISEGUNDOS_POR_DIA);
  const verTodos = await puedeVerTodosProyectos(usuario.id);
  const proyectoWhere: Prisma.ProyectoWhereInput = {
    activo: true,
    ...filtroProyectosVisibles(usuario.id, verTodos),
  };

  const activoBase: Prisma.ActivoWhereInput = {
    estado: { not: EstadoActivo.DE_BAJA },
  };
  const incidenciaPeriodo: Prisma.IncidenciaWhereInput = {
    fechaNotificacion: { gte: desde, lte: hasta },
  };
  const mantenimientoPeriodo: Prisma.OrdenMantenimientoWhereInput = {
    activo: true,
    fechaProgramada: { gte: desde, lte: hasta },
  };

  const [
    totalActivos,
    equiposAsignados,
    activosPorTipo,
    ticketsPendientes,
    ticketsCreados,
    ticketsCompletados,
    incidenciasPorEstado,
    licenciasActivas,
    licenciasPorVencer,
    licenciasVencidas,
    proyectosActivos,
    proyectosEnProgreso,
    proyectosVencidos,
    proyectosPorEstado,
    mantenimientosPeriodo,
    mantenimientosCompletados,
    costoMantenimientos,
    mantenimientosPorEstado,
    horasPeriodo,
    hitosProximos,
  ] = await Promise.all([
    prisma.activo.count({ where: activoBase }),
    prisma.activo.count({
      where: { ...activoBase, responsableId: { not: null } },
    }),
    prisma.activo.groupBy({
      by: ['tipo'],
      where: activoBase,
      _count: { _all: true },
    }),
    prisma.incidencia.count({
      where: { estado: { not: EstadoIncidencia.COMPLETADO } },
    }),
    prisma.incidencia.count({ where: incidenciaPeriodo }),
    prisma.incidencia.count({
      where: { fechaResolucion: { gte: desde, lte: hasta } },
    }),
    prisma.incidencia.groupBy({
      by: ['estado'],
      where: incidenciaPeriodo,
      _count: { _all: true },
    }),
    prisma.licencia.count({ where: { activa: true } }),
    prisma.licencia.count({
      where: {
        activa: true,
        fechaVencimiento: { gte: ahora, lte: en30Dias },
      },
    }),
    prisma.licencia.count({
      where: { activa: true, fechaVencimiento: { lt: ahora } },
    }),
    prisma.proyecto.count({ where: proyectoWhere }),
    prisma.proyecto.count({
      where: { ...proyectoWhere, estado: EstadoProyecto.EN_PROGRESO },
    }),
    prisma.proyecto.count({
      where: {
        ...proyectoWhere,
        estado: { notIn: [EstadoProyecto.COMPLETADO, EstadoProyecto.CANCELADO] },
        fechaFinPlanificada: { lt: ahora },
      },
    }),
    prisma.proyecto.groupBy({
      by: ['estado'],
      where: proyectoWhere,
      _count: { _all: true },
    }),
    prisma.ordenMantenimiento.count({ where: mantenimientoPeriodo }),
    prisma.ordenMantenimiento.count({
      where: {
        ...mantenimientoPeriodo,
        estado: MantenimientoEstado.COMPLETADO,
      },
    }),
    prisma.ordenMantenimiento.aggregate({
      where: {
        ...mantenimientoPeriodo,
        estado: MantenimientoEstado.COMPLETADO,
      },
      _sum: { costo: true },
    }),
    prisma.ordenMantenimiento.groupBy({
      by: ['estado'],
      where: mantenimientoPeriodo,
      _count: { _all: true },
    }),
    prisma.proyectoRegistroHoras.aggregate({
      where: {
        activo: true,
        fecha: { gte: desde, lte: hasta },
        proyecto: proyectoWhere,
      },
      _sum: { horas: true },
    }),
    prisma.proyectoHito.count({
      where: {
        activo: true,
        estado: EstadoHito.PENDIENTE,
        fechaPlanificada: { gte: ahora, lte: en30Dias },
        proyecto: proyectoWhere,
      },
    }),
  ]);

  const activosTipo = activosPorTipo
    .map((fila) => ({ tipo: fila.tipo, cantidad: fila._count._all }))
    .sort((a, b) => b.cantidad - a.cantidad);

  return {
    titulo: 'Reporte ejecutivo del periodo',
    subtitulo: `${desde.toISOString().slice(0, 10)} a ${hasta.toISOString().slice(0, 10)}`,
    generadoEn: new Date(),
    generadoPor: usuario.nombre,
    metadatos: {
      'Periodo desde': desde.toISOString(),
      'Periodo hasta': hasta.toISOString(),
      'Visibilidad de proyectos': verTodos
        ? 'Todos los proyectos'
        : 'Solo proyectos visibles',
      'Costo de mantenimientos concluidos':
        costoMantenimientos._sum.costo === null
          ? '0.00'
          : Number(costoMantenimientos._sum.costo).toFixed(2),
    },
    secciones: [
      {
        nombre: 'Resumen ejecutivo',
        columnas: [
          { clave: 'activos', encabezado: 'Activos', ancho: 12 },
          { clave: 'asignados', encabezado: 'Asignados', ancho: 12 },
          { clave: 'ticketsPendientes', encabezado: 'Tickets pendientes', ancho: 18 },
          { clave: 'ticketsCreados', encabezado: 'Tickets creados', ancho: 16 },
          { clave: 'ticketsCompletados', encabezado: 'Tickets completados', ancho: 18 },
          { clave: 'licenciasActivas', encabezado: 'Licencias activas', ancho: 16 },
          { clave: 'licenciasPorVencer', encabezado: 'Licencias por vencer 30d', ancho: 20 },
          { clave: 'licenciasVencidas', encabezado: 'Licencias vencidas', ancho: 18 },
          { clave: 'proyectosActivos', encabezado: 'Proyectos activos', ancho: 16 },
          { clave: 'proyectosEnProgreso', encabezado: 'Proyectos en progreso', ancho: 18 },
          { clave: 'proyectosVencidos', encabezado: 'Proyectos vencidos', ancho: 18 },
          { clave: 'hitosProximos', encabezado: 'Hitos próximos 30d', ancho: 18 },
          { clave: 'mantenimientos', encabezado: 'Mantenimientos', ancho: 16 },
          { clave: 'mantenimientosCompletados', encabezado: 'Mantenimientos concluidos', ancho: 22 },
          { clave: 'horasPeriodo', encabezado: 'Horas registradas', ancho: 18 },
        ],
        filas: [
          {
            activos: totalActivos,
            asignados: equiposAsignados,
            ticketsPendientes,
            ticketsCreados,
            ticketsCompletados,
            licenciasActivas,
            licenciasPorVencer,
            licenciasVencidas,
            proyectosActivos,
            proyectosEnProgreso,
            proyectosVencidos,
            hitosProximos,
            mantenimientos: mantenimientosPeriodo,
            mantenimientosCompletados,
            horasPeriodo:
              horasPeriodo._sum.horas === null
                ? 0
                : Number(horasPeriodo._sum.horas),
          },
        ],
      },
      {
        nombre: 'Inventario por tipo',
        columnas: [
          { clave: 'tipo', encabezado: 'Tipo de activo', ancho: 24 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: activosTipo,
      },
      {
        nombre: 'Incidencias por estado',
        columnas: [
          { clave: 'estado', encabezado: 'Estado', ancho: 22 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: incidenciasPorEstado.map((fila) => ({
          estado: fila.estado,
          cantidad: fila._count._all,
        })),
      },
      {
        nombre: 'Licencias por vigencia',
        columnas: [
          { clave: 'vigencia', encabezado: 'Vigencia', ancho: 22 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [
          { vigencia: 'VIGENTES', cantidad: licenciasActivas - licenciasPorVencer - licenciasVencidas },
          { vigencia: 'POR_VENCER_30D', cantidad: licenciasPorVencer },
          { vigencia: 'VENCIDAS', cantidad: licenciasVencidas },
        ],
      },
      {
        nombre: 'Proyectos por estado',
        columnas: [
          { clave: 'estado', encabezado: 'Estado', ancho: 22 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: proyectosPorEstado.map((fila) => ({
          estado: fila.estado,
          cantidad: fila._count._all,
        })),
      },
      {
        nombre: 'Mantenimientos por estado',
        columnas: [
          { clave: 'estado', encabezado: 'Estado', ancho: 22 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: mantenimientosPorEstado.map((fila) => ({
          estado: fila.estado,
          cantidad: fila._count._all,
        })),
      },
    ],
  };
};

export const ejecutivoMensualReporte: ReporteDefinicion = {
  codigo: 'ejecutivo-mensual',
  nombre: 'Reporte ejecutivo mensual',
  descripcion:
    'Resumen ejecutivo del periodo: inventario, incidencias, licencias, proyectos, mantenimientos y horas.',
  modulo: 'Dashboard / Ejecutivo',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: [
    'dashboard:leer',
    'activos:leer',
    'incidencias:leer',
    'licencias:administrar',
    'proyectos:leer',
    'mantenimiento:leer',
  ],
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
  ],
  maxFilas: 100,
  validarFiltros,
  cargar: cargarEjecutivo,
};
