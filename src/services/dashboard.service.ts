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

export const obtenerResumen = async (
  sucursal: SucursalDashboard | null
): Promise<ResumenDashboard> => {
  const activoBase: Prisma.ActivoWhereInput = {
    estado: { not: EstadoActivo.DE_BAJA },
    ...filtroSucursal(sucursal),
  };

  const [totalActivos, equiposAsignados, ticketsPendientes, agrupado, licencias] =
    await Promise.all([
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
    ]);

  const activosPorTipo: ActivoPorTipo[] = agrupado
    .map((fila) => ({ tipo: fila.tipo, total: fila._count._all }))
    .sort((a, b) => b.total - a.total);

  const licenciasPorVencer: LicenciaPorVencer[] = licencias;

  return {
    kpis: { ticketsPendientes, totalActivos, equiposAsignados },
    activosPorTipo,
    licenciasPorVencer,
    recordatorios: [],
  };
};
