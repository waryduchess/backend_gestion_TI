import {
  EstadoProyecto,
  Prioridad,
  RolProyecto,
} from '../generated/prisma/client';
import { MetadatosPaginacion, UsuarioResumen } from './comun.model';

export interface DepartamentoResumen {
  id: number;
  nombre: string;
}

export interface ProyectoMiembroResumen {
  proyectoId: number;
  usuarioId: string;
  rol: RolProyecto;
  usuario: UsuarioResumen;
  createdAt: Date;
}

export interface ResumenTareasProyecto {
  total: number;
  completadas: number;
  pendientes: number;
  enProgreso: number;
  canceladas: number;
  subtareasTotal: number;
  subtareasCompletadas: number;
}

export interface ProgresoProyecto {
  progreso: number;
  resumenTareas: ResumenTareasProyecto;
}

export interface ResumenHorasProyecto {
  totalHoras: number;
  totalRegistros: number;
}

export interface ProyectoDetalle
  extends ProyectoResumen,
    ProgresoProyecto {
  miembros: ProyectoMiembroResumen[];
  resumenHoras: ResumenHorasProyecto;
}

export interface DatosMiembroProyecto {
  usuarioId: string;
  rol: RolProyecto;
}

export interface ProyectoResumen {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  fechaInicio: Date;
  fechaFinPlanificada: Date;
  fechaFinReal: Date | null;
  presupuesto: number | null;
  activo: boolean;
  responsable: UsuarioResumen;
  departamento: DepartamentoResumen | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionProyecto {
  nombre: string;
  descripcion: string | null;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  fechaInicio: Date;
  fechaFinPlanificada: Date;
  fechaFinReal: Date | null;
  presupuesto: number | null;
  responsableId: string;
  departamentoId: number | null;
}

export interface DatosEdicionProyecto {
  nombre?: string;
  descripcion?: string | null;
  estado?: EstadoProyecto;
  prioridad?: Prioridad;
  fechaInicio?: Date;
  fechaFinPlanificada?: Date;
  fechaFinReal?: Date | null;
  presupuesto?: number | null;
  responsableId?: string;
  departamentoId?: number | null;
  activo?: boolean;
}

export interface ParametrosListadoProyectos {
  page: number;
  limit: number;
  usuarioId: string;
  q?: string;
  estado?: EstadoProyecto;
  prioridad?: Prioridad;
  responsableId?: string;
  departamentoId?: number;
  activo?: boolean;
}

export interface ResultadoListadoProyectos {
  proyectos: ProyectoResumen[];
  meta: MetadatosPaginacion;
}

export const ESTADOS_PROYECTO = Object.values(EstadoProyecto);
export const PRIORIDADES_PROYECTO = Object.values(Prioridad);
export const ROLES_PROYECTO = Object.values(RolProyecto);
