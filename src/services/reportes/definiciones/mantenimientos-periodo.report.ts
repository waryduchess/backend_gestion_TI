import {
  MantenimientoEstado,
  MantenimientoPrioridad,
  MantenimientoTipo,
  Prisma,
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
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

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
    Object.values(MantenimientoEstado)
  ) as MantenimientoEstado | undefined;
  const tipo = validarOpcion(
    query.tipo,
    'tipo',
    Object.values(MantenimientoTipo)
  ) as MantenimientoTipo | undefined;
  const prioridad = validarOpcion(
    query.prioridad,
    'prioridad',
    Object.values(MantenimientoPrioridad)
  ) as MantenimientoPrioridad | undefined;

  const activoId = comoEntero(query.activoId, 'activoId', 0);
  if (activoId < 0) {
    throw new HttpError(400, 'El parámetro "activoId" debe ser positivo', [
      { campo: 'activoId', valor: String(activoId) },
    ]);
  }

  return {
    desde,
    hasta,
    estado,
    tipo,
    prioridad,
    tecnicoId: textoOpcional(query.tecnicoId),
    activoId: activoId > 0 ? activoId : undefined,
    q: textoOpcional(query.q),
  };
};

const cargarMantenimientos = async (
  filtros: Record<string, unknown>
): Promise<ReporteDocumento> => {
  const desde = filtros.desde as Date;
  const hasta = filtros.hasta as Date;
  const estado = filtros.estado as MantenimientoEstado | undefined;
  const tipo = filtros.tipo as MantenimientoTipo | undefined;
  const prioridad = filtros.prioridad as MantenimientoPrioridad | undefined;
  const tecnicoId = filtros.tecnicoId as string | undefined;
  const activoId = filtros.activoId as number | undefined;
  const q = filtros.q as string | undefined;

  const where: Prisma.OrdenMantenimientoWhereInput = {
    activo: true,
    fechaProgramada: { gte: desde, lte: hasta },
    ...(estado ? { estado } : {}),
    ...(tipo ? { tipo } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(tecnicoId ? { tecnicoId } : {}),
    ...(activoId ? { activoId } : {}),
    ...(q
      ? {
          OR: [
            { folio: { contains: q } },
            { descripcion: { contains: q } },
            { tecnico: { is: { nombre: { contains: q } } } },
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
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.ordenMantenimiento.findMany({
      where,
      orderBy: [{ fechaProgramada: 'asc' }, { id: 'asc' }],
      take: MAX_FILAS,
      include: {
        activoRel: {
          select: { id: true, claveActivo: true, cb23: true, tipo: true },
        },
        tecnico: {
          select: { id: true, nombre: true, email: true },
        },
      },
    }),
    prisma.ordenMantenimiento.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  const resumenEstado = new Map<
    MantenimientoEstado,
    { cantidad: number; costoConcluido: number }
  >();
  const resumenTipo = new Map<
    MantenimientoTipo,
    { cantidad: number; costoConcluido: number }
  >();
  let costoConcluido = 0;

  for (const fila of filas) {
    const costo = fila.costo === null ? 0 : Number(fila.costo);
    const costoFila = fila.estado === MantenimientoEstado.COMPLETADO ? costo : 0;
    costoConcluido += costoFila;

    const porEstado = resumenEstado.get(fila.estado) ?? {
      cantidad: 0,
      costoConcluido: 0,
    };
    porEstado.cantidad += 1;
    porEstado.costoConcluido += costoFila;
    resumenEstado.set(fila.estado, porEstado);

    const porTipo = resumenTipo.get(fila.tipo) ?? {
      cantidad: 0,
      costoConcluido: 0,
    };
    porTipo.cantidad += 1;
    porTipo.costoConcluido += costoFila;
    resumenTipo.set(fila.tipo, porTipo);
  }

  return {
    titulo: 'Reporte de mantenimientos por periodo',
    subtitulo: `Total de registros: ${total}`,
    generadoEn: new Date(),
    generadoPor: 'Sistema',
    metadatos: {
      'Periodo desde': desde.toISOString(),
      'Periodo hasta': hasta.toISOString(),
      'Estado': estado ?? 'Todos',
      'Tipo': tipo ?? 'Todos',
      'Prioridad': prioridad ?? 'Todas',
      'Técnico': tecnicoId ?? 'Todos',
      'Activo': activoId ? String(activoId) : 'Todos',
      'Búsqueda': q ?? 'Sin búsqueda',
      'Costo acumulado (concluidos)': costoConcluido.toFixed(2),
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Resumen por estado',
        columnas: [
          { clave: 'estado', encabezado: 'Estado', ancho: 20 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
          { clave: 'costoConcluido', encabezado: 'Costo concluido', ancho: 18 },
        ],
        filas: [...resumenEstado.entries()].map(([estadoFila, datos]) => ({
          estado: estadoFila,
          cantidad: datos.cantidad,
          costoConcluido: datos.costoConcluido,
        })),
        totales: {
          cantidad: total,
          costoConcluido,
        },
      },
      {
        nombre: 'Resumen por tipo',
        columnas: [
          { clave: 'tipo', encabezado: 'Tipo', ancho: 20 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
          { clave: 'costoConcluido', encabezado: 'Costo concluido', ancho: 18 },
        ],
        filas: [...resumenTipo.entries()].map(([tipoFila, datos]) => ({
          tipo: tipoFila,
          cantidad: datos.cantidad,
          costoConcluido: datos.costoConcluido,
        })),
        totales: {
          cantidad: total,
          costoConcluido,
        },
      },
      {
        nombre: 'Detalle de mantenimientos',
        columnas: [
          { clave: 'folio', encabezado: 'Folio', ancho: 14 },
          { clave: 'activoClave', encabezado: 'Activo', ancho: 16 },
          { clave: 'activoCb23', encabezado: 'CB23', ancho: 18 },
          { clave: 'activoTipo', encabezado: 'Tipo de activo', ancho: 18 },
          { clave: 'tipo', encabezado: 'Tipo de mantenimiento', ancho: 22 },
          { clave: 'estado', encabezado: 'Estado', ancho: 18 },
          { clave: 'prioridad', encabezado: 'Prioridad', ancho: 14 },
          { clave: 'tecnico', encabezado: 'Técnico', ancho: 28 },
          { clave: 'fechaProgramada', encabezado: 'Fecha programada', ancho: 20 },
          { clave: 'fechaRealizada', encabezado: 'Fecha realizada', ancho: 20 },
          { clave: 'costo', encabezado: 'Costo', ancho: 14 },
          { clave: 'descripcion', encabezado: 'Descripción', ancho: 40 },
        ],
        filas: filas.map((fila) => ({
          folio: fila.folio,
          activoClave: fila.activoRel.claveActivo,
          activoCb23: fila.activoRel.cb23,
          activoTipo: fila.activoRel.tipo,
          tipo: fila.tipo,
          estado: fila.estado,
          prioridad: fila.prioridad,
          tecnico: fila.tecnico.nombre,
          fechaProgramada: fila.fechaProgramada,
          fechaRealizada: fila.fechaRealizada,
          costo: fila.costo === null ? null : Number(fila.costo),
          descripcion: fila.descripcion,
        })),
      },
    ],
  };
};

export const mantenimientosPeriodoReporte: ReporteDefinicion = {
  codigo: 'mantenimientos-periodo',
  nombre: 'Mantenimientos por periodo',
  descripcion:
    'Ordenes de mantenimiento por rango de fechas programadas, con resumen por estado/tipo y costo de concluidos.',
  modulo: 'Mantenimiento',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['mantenimiento:leer'],
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
      descripcion: 'Estado de la orden.',
      opciones: Object.values(MantenimientoEstado),
    },
    {
      nombre: 'tipo',
      tipo: 'enum',
      descripcion: 'Tipo de mantenimiento.',
      opciones: Object.values(MantenimientoTipo),
    },
    {
      nombre: 'prioridad',
      tipo: 'enum',
      descripcion: 'Prioridad de la orden.',
      opciones: Object.values(MantenimientoPrioridad),
    },
    {
      nombre: 'tecnicoId',
      tipo: 'texto',
      descripcion: 'ID del técnico asignado.',
    },
    {
      nombre: 'activoId',
      tipo: 'texto',
      descripcion: 'ID del activo.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en folio, descripción, técnico o activo.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarMantenimientos,
};
