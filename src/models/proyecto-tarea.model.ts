import {
  EstadoTarea,
  Prioridad,
} from '../generated/prisma/client';
import { MetadatosPaginacion, UsuarioResumen } from './comun.model';

export interface TareaResumen {
  id: number;
  proyectoId: number;
  parentId: number | null;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  asignadoAId: string | null;
  asignadoA: UsuarioResumen | null;
  fechaInicio: Date | null;
  fechaVencimiento: Date | null;
  fechaCompletada: Date | null;
  orden: number;
  activo: boolean;
  subtareas: TareaResumen[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionTarea {
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  parentId: number | null;
  asignadoAId: string | null;
  fechaInicio: Date | null;
  fechaVencimiento: Date | null;
  fechaCompletada: Date | null;
  orden: number;
}

export interface DatosEdicionTarea {
  titulo?: string;
  descripcion?: string | null;
  estado?: EstadoTarea;
  prioridad?: Prioridad;
  asignadoAId?: string | null;
  fechaInicio?: Date | null;
  fechaVencimiento?: Date | null;
  fechaCompletada?: Date | null;
  orden?: number;
}

export interface ParametrosListadoTareas {
  page: number;
  limit: number;
  q?: string;
  estado?: EstadoTarea;
  prioridad?: Prioridad;
  asignadoAId?: string;
}

export interface ResultadoListadoTareas {
  tareas: TareaResumen[];
  meta: MetadatosPaginacion;
}

export const ESTADOS_TAREA = Object.values(EstadoTarea);
export const PRIORIDADES_TAREA = Object.values(Prioridad);
