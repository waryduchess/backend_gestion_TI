import { EstadoHito } from '../generated/prisma/client';

export interface HitoProyectoResumen {
  id: number;
  proyectoId: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoHito;
  fechaPlanificada: Date;
  fechaCompletada: Date | null;
  orden: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionHito {
  titulo: string;
  descripcion: string | null;
  estado: EstadoHito;
  fechaPlanificada: Date;
  fechaCompletada: Date | null;
  orden: number;
}

export interface DatosEdicionHito {
  titulo?: string;
  descripcion?: string | null;
  estado?: EstadoHito;
  fechaPlanificada?: Date;
  fechaCompletada?: Date | null;
  orden?: number;
}

export const ESTADOS_HITO = Object.values(EstadoHito);
