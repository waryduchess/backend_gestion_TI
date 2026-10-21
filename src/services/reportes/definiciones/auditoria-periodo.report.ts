import { Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import { HttpError } from '../../../middlewares/error.middleware';
import {
  ACCIONES_AUDITORIA,
  MODULOS_AUDITORIA,
} from '../../../models/auditoria.model';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import { comoFecha, validarOpcion } from '../../../utils/validacion';

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

  const modulo = validarOpcion(query.modulo, 'modulo', [
    ...MODULOS_AUDITORIA,
  ]);
  const accion = validarOpcion(query.accion, 'accion', [
    ...ACCIONES_AUDITORIA,
  ]);
  const entidadId = textoOpcional(query.entidadId);

  return {
    desde,
    hasta,
    modulo,
    accion,
    usuarioId: textoOpcional(query.usuarioId),
    entidadId,
    q: textoOpcional(query.q),
  };
};

const cargarAuditoria = async (
  filtros: Record<string, unknown>
): Promise<ReporteDocumento> => {
  const desde = filtros.desde as Date;
  const hasta = filtros.hasta as Date;
  const modulo = filtros.modulo as string | undefined;
  const accion = filtros.accion as string | undefined;
  const usuarioId = filtros.usuarioId as string | undefined;
  const entidadId = filtros.entidadId as string | undefined;
  const q = filtros.q as string | undefined;

  const where: Prisma.AuditoriaWhereInput = {
    realizadaEn: { gte: desde, lte: hasta },
    ...(modulo ? { modulo } : {}),
    ...(accion ? { accion } : {}),
    ...(usuarioId ? { usuarioId } : {}),
    ...(entidadId ? { entidadId } : {}),
    ...(q
      ? {
          OR: [
            { modulo: { contains: q } },
            { accion: { contains: q } },
            { entidadId: { contains: q } },
            { usuario: { nombre: { contains: q } } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.auditoria.findMany({
      where,
      orderBy: [{ realizadaEn: 'desc' }, { id: 'desc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        modulo: true,
        accion: true,
        entidadId: true,
        detalle: true,
        realizadaEn: true,
        usuario: {
          select: { id: true, nombre: true },
        },
      },
    }),
    prisma.auditoria.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  const resumenModulo = new Map<string, number>();
  const resumenAccion = new Map<string, number>();
  const resumenUsuario = new Map<string, { usuario: string; cantidad: number }>();

  const detalle = filas.map((fila) => {
    resumenModulo.set(fila.modulo, (resumenModulo.get(fila.modulo) ?? 0) + 1);
    resumenAccion.set(fila.accion, (resumenAccion.get(fila.accion) ?? 0) + 1);
    const usuario = resumenUsuario.get(fila.usuario.id) ?? {
      usuario: fila.usuario.nombre,
      cantidad: 0,
    };
    usuario.cantidad += 1;
    resumenUsuario.set(fila.usuario.id, usuario);

    return {
      id: fila.id,
      realizadaEn: fila.realizadaEn,
      modulo: fila.modulo,
      accion: fila.accion,
      entidadId: fila.entidadId,
      usuario: fila.usuario.nombre,
      detalle:
        fila.detalle === null ? null : JSON.stringify(fila.detalle),
    };
  });

  return {
    titulo: 'Reporte de auditoría por periodo',
    subtitulo: `Total de movimientos: ${total}`,
    generadoEn: new Date(),
    generadoPor: 'Sistema',
    metadatos: {
      'Periodo desde': desde.toISOString(),
      'Periodo hasta': hasta.toISOString(),
      Módulo: modulo ?? 'Todos',
      Acción: accion ?? 'Todas',
      Usuario: usuarioId ?? 'Todos',
      Entidad: entidadId ?? 'Todas',
      Búsqueda: q ?? 'Sin búsqueda',
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Resumen',
        columnas: [
          { clave: 'movimientos', encabezado: 'Movimientos', ancho: 14 },
          { clave: 'modulos', encabezado: 'Módulos distintos', ancho: 18 },
          { clave: 'acciones', encabezado: 'Acciones distintas', ancho: 18 },
          { clave: 'usuarios', encabezado: 'Usuarios distintos', ancho: 18 },
        ],
        filas: [
          {
            movimientos: total,
            modulos: resumenModulo.size,
            acciones: resumenAccion.size,
            usuarios: resumenUsuario.size,
          },
        ],
      },
      {
        nombre: 'Resumen por módulo',
        columnas: [
          { clave: 'modulo', encabezado: 'Módulo', ancho: 24 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenModulo.entries()]
          .map(([moduloFila, cantidad]) => ({ modulo: moduloFila, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        totales: { cantidad: total },
      },
      {
        nombre: 'Resumen por acción',
        columnas: [
          { clave: 'accion', encabezado: 'Acción', ancho: 24 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenAccion.entries()]
          .map(([accionFila, cantidad]) => ({ accion: accionFila, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        totales: { cantidad: total },
      },
      {
        nombre: 'Resumen por usuario',
        columnas: [
          { clave: 'usuario', encabezado: 'Usuario', ancho: 30 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenUsuario.values()].sort((a, b) => b.cantidad - a.cantidad),
        totales: { cantidad: total },
      },
      {
        nombre: 'Detalle de auditoría',
        columnas: [
          { clave: 'id', encabezado: 'ID', ancho: 8 },
          { clave: 'realizadaEn', encabezado: 'Fecha y hora', ancho: 22 },
          { clave: 'modulo', encabezado: 'Módulo', ancho: 22 },
          { clave: 'accion', encabezado: 'Acción', ancho: 18 },
          { clave: 'entidadId', encabezado: 'Entidad', ancho: 18 },
          { clave: 'usuario', encabezado: 'Usuario', ancho: 30 },
          { clave: 'detalle', encabezado: 'Detalle', ancho: 50 },
        ],
        filas: detalle,
      },
    ],
  };
};

export const auditoriaPeriodoReporte: ReporteDefinicion = {
  codigo: 'auditoria-periodo',
  nombre: 'Auditoría por periodo',
  descripcion:
    'Bitácora de movimientos por rango de fechas, módulo, acción, usuario o entidad; no expone valores sensibles.',
  modulo: 'Auditoría',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['auditoria:leer'],
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
      nombre: 'modulo',
      tipo: 'enum',
      descripcion: 'Módulo afectado.',
      opciones: [...MODULOS_AUDITORIA],
    },
    {
      nombre: 'accion',
      tipo: 'enum',
      descripcion: 'Acción realizada.',
      opciones: [...ACCIONES_AUDITORIA],
    },
    {
      nombre: 'usuarioId',
      tipo: 'texto',
      descripcion: 'ID del usuario que realizó la acción.',
    },
    {
      nombre: 'entidadId',
      tipo: 'texto',
      descripcion: 'ID de la entidad afectada.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en módulo, acción, entidad o usuario.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarAuditoria,
};
