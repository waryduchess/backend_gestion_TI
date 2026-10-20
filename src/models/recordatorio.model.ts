import { PrioridadRecordatorio } from '../generated/prisma/client';
import { MetadatosPaginacion } from './comun.model';

export interface RecordatorioResumen {
  id: number;
  titulo: string;
  descripcion: string | null;
  fecha: Date | null;
  prioridad: PrioridadRecordatorio;
  completado: boolean;
  completadoEn: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecordatorioProximo {
  id: number;
  titulo: string;
  fecha: Date;
  prioridad: PrioridadRecordatorio;
}

export interface DatosCreacionRecordatorio {
  titulo: string;
  descripcion: string | null;
  fecha: Date | null;
  prioridad: PrioridadRecordatorio;
}

export interface DatosEdicionRecordatorio {
  titulo?: string;
  descripcion?: string | null;
  fecha?: Date | null;
  prioridad?: PrioridadRecordatorio;
}

export interface ParametrosListadoRecordatorios {
  usuarioId: string;
  page: number;
  limit: number;
  q?: string;
  completado?: boolean;
  prioridad?: PrioridadRecordatorio;
  desde?: Date;
  hasta?: Date;
  sinFecha?: boolean;
}

export interface ResultadoListadoRecordatorios {
  recordatorios: RecordatorioResumen[];
  meta: MetadatosPaginacion;
}

export const PRIORIDADES_RECORDATORIO = Object.values(
  PrioridadRecordatorio
);
