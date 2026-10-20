import {
  MantenimientoEstado,
  MantenimientoPrioridad,
  MantenimientoTipo,
  Prisma,
} from '../generated/prisma/client';
import { MetadatosPaginacion, UsuarioResumen } from './comun.model';

export interface ActivoMantenimientoResumen {
  id: number;
  cb23: string | null;
  tipo: string;
}

export interface MantenimientoResumen {
  id: number;
  folio: string;
  activoId: number;
  activo: ActivoMantenimientoResumen;
  tipo: MantenimientoTipo;
  estado: MantenimientoEstado;
  prioridad: MantenimientoPrioridad;
  tecnicoId: string;
  tecnico: UsuarioResumen;
  fechaProgramada: Date;
  fechaRealizada: Date | null;
  costo: number | null;
  descripcion: string | null;
  evidencias: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionMantenimiento {
  activoId: number;
  tipo: MantenimientoTipo;
  estado: MantenimientoEstado;
  prioridad: MantenimientoPrioridad;
  tecnicoId: string;
  fechaProgramada: Date;
  fechaRealizada: Date | null;
  costo: number | null;
  descripcion: string | null;
}

export interface DatosEdicionMantenimiento {
  activoId?: number;
  tipo?: MantenimientoTipo;
  estado?: MantenimientoEstado;
  prioridad?: MantenimientoPrioridad;
  tecnicoId?: string;
  fechaProgramada?: Date;
  fechaRealizada?: Date | null;
  costo?: number | null;
  descripcion?: string | null;
}

export interface ParametrosListadoMantenimiento {
  page: number;
  limit: number;
  q?: string;
  tipo?: MantenimientoTipo;
  estado?: MantenimientoEstado;
  prioridad?: MantenimientoPrioridad;
  tecnicoId?: string;
  activoId?: number;
}

export interface ResultadoListadoMantenimiento {
  mantenimientos: MantenimientoResumen[];
  meta: MetadatosPaginacion;
}

export const TIPOS_MANTENIMIENTO = Object.values(MantenimientoTipo);
export const ESTADOS_MANTENIMIENTO = Object.values(MantenimientoEstado);
export const PRIORIDADES_MANTENIMIENTO = Object.values(MantenimientoPrioridad);
