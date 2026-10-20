import {
  EstadoActivo,
  EstadoIncidencia,
  Prisma,
} from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import {
  ActivoPorTipo,
  LicenciaPorVencer,
  ResumenDashboard,
  SucursalDashboard,
} from '../models/dashboard.model';
import {
  calcularPermisosEfectivos,
  normalizarPermisos,
} from '../utils/permisos';

const SELECT_USUARIO = {
  select: { id: true, nombre: true, email: true },
} as const;

const MAPA_SUCURSALES: Record<SucursalDashboard, string[]> = {
  CANCUN: ['CANCUN', 'STOCK CUN'],
  PLAYA: ['PLAYA', 'STOCK'],
};

const filtroSucursal = (
  sucursal: SucursalDashboard | null
): Prisma.ActivoWhereInput =>
  sucursal ? { sucursal: { in: MAPA_SUCURSALES[sucursal] } } : {};

const puedeLeerRecordatorios = async (usuarioId: string): Promise<boolean> => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      permisosExtra: true,
      permisosRevocados: true,
      rol: {
        select: { activo: true, permisos: true },
      },
    },
  });

  if (!usuario?.rol?.activo) return false;

  try {
    const permisos = calcularPermisosEfectivos(
      normalizarPermisos(usuario.rol.permisos, 'Rol del usuario del dashboard'),
      normalizarPermisos(usuario.permisosExtra, 'permisosExtra del dashboard'),
      normalizarPermisos(
        usuario.permisosRevocados,
        'permisosRevocados del dashboard'
      )
    );
    return permisos.includes('recordatorios:leer');
  } catch {
    return false;
  }
};

export const obtenerResumen = async (
  sucursal: SucursalDashboard | null,
  usuarioId: string
): Promise<ResumenDashboard> => {
  const activoBase: Prisma.ActivoWhereInput = {
    estado: { not: EstadoActivo.DE_BAJA },
    ...filtroSucursal(sucursal),
  };
  const incluirRecordatorios = await puedeLeerRecordatorios(usuarioId);

  const [
    totalActivos,
    equiposAsignados,
    ticketsPendientes,
    agrupado,
    licencias,
    recordatorios,
  ] = await Promise.all([
      prisma.activo.count({ where: activoBase }),
      prisma.activo.count({
        where: { ...activoBase, responsableId: { not: null } },
      }),
      prisma.incidencia.count({
        where: { estado: { not: EstadoIncidencia.COMPLETADO } },
      }),
      prisma.activo.groupBy({
        by: ['tipo'],
        where: activoBase,
        _count: { _all: true },
      }),
      prisma.licencia.findMany({
        where: { activa: true },
        orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
        take: 5,
        select: {
          id: true,
          software: true,
          proveedor: true,
          fechaVencimiento: true,
          asignadaA: SELECT_USUARIO,
        },
      }),
      incluirRecordatorios
        ? prisma.recordatorio.findMany({
            where: {
              usuarioId,
              activo: true,
              completado: false,
              fecha: { not: null },
            },
            orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
            take: 5,
            select: {
              id: true,
              titulo: true,
              fecha: true,
              prioridad: true,
            },
          })
        : Promise.resolve([]),
    ]);

  const activosPorTipo: ActivoPorTipo[] = agrupado
    .map((fila) => ({ tipo: fila.tipo, total: fila._count._all }))
    .sort((a, b) => b.total - a.total);

  const licenciasPorVencer: LicenciaPorVencer[] = licencias;
  const proximosRecordatorios = recordatorios.flatMap((recordatorio) =>
    recordatorio.fecha === null
      ? []
      : [
          {
            id: recordatorio.id,
            titulo: recordatorio.titulo,
            fecha: recordatorio.fecha,
            prioridad: recordatorio.prioridad,
          },
        ]
  );

  return {
    kpis: { ticketsPendientes, totalActivos, equiposAsignados },
    activosPorTipo,
    licenciasPorVencer,
    recordatorios: proximosRecordatorios,
  };
};
