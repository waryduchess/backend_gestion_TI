import { Prisma } from '../generated/prisma/client';

export const MODULOS_AUDITORIA = [
  'SECRETOS',
  'ACTIVOS',
  'USUARIOS',
  'ROLES',
  'CATALOGOS',
  'LICENCIAS',
  'INCIDENCIAS',
  'ASIGNACIONES',
  'IMPORTACIONES',
  'MANTENIMIENTO',
] as const;

export type ModuloAuditoria = (typeof MODULOS_AUDITORIA)[number];

export const ACCIONES_AUDITORIA = [
  'CREAR',
  'ACTUALIZAR',
  'DESACTIVAR',
  'REVELAR',
  'IMPORTAR',
  'ASIGNAR',
  'DEVOLVER',
  'ELIMINAR',
] as const;

export type AccionAuditoria = (typeof ACCIONES_AUDITORIA)[number];

export interface DetalleAuditoria {
  campos?: string[];
  resumen?: Record<string, number>;
}

export interface DatosRegistroAuditoria {
  modulo: ModuloAuditoria;
  accion: AccionAuditoria;
  entidadId: string | number | null;
  usuarioId: string;
  detalle?: Prisma.InputJsonValue | null;
}

export interface AuditoriaResumen {
  id: number;
  modulo: string;
  accion: string;
  entidadId: string | null;
  detalle: Prisma.JsonValue | null;
  realizadaEn: Date;
  usuario: {
    id: string;
    nombre: string;
  };
}

export interface ParametrosListadoAuditoriaGlobal {
  page: number;
  limit: number;
  modulo?: string;
  accion?: string;
  usuarioId?: string;
  entidadId?: string;
  desde?: Date;
  hasta?: Date;
  q?: string;
}

export interface MetadatosListadoAuditoria {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
