import {
  EstadoIncidencia,
  Prioridad,
  TipoRequerimiento,
} from '../generated/prisma/client';

export interface UsuarioResumen {
  id: string;
  nombre: string;
  email: string | null;
}

export interface DepartamentoResumen {
  id: number;
  nombre: string;
}

export interface IncidenciaLista {
  id: number;
  originalId: number | null;
  titulo: string;
  estado: EstadoIncidencia;
  prioridad: Prioridad;
  tipoRequerimiento: TipoRequerimiento;
  fechaNotificacion: Date;
  fechaResolucion: Date | null;
  solicitante: UsuarioResumen;
  asignadoA: UsuarioResumen | null;
  departamento: DepartamentoResumen | null;
  totalActualizaciones: number;
}

export interface ParametrosListadoIncidencias {
  page: number;
  limit: number;
  estado?: EstadoIncidencia;
  prioridad?: Prioridad;
}

export interface MetadatosPaginacion {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RespuestaPaginada<T> {
  success: boolean;
  message: string;
  errors: unknown[];
  data: T[];
  meta: MetadatosPaginacion;
}

export const ESTADOS_VALIDOS = Object.values(EstadoIncidencia);
export const PRIORIDADES_VALIDAS = Object.values(Prioridad);

export type EstadoIncidenciaValor = EstadoIncidencia;
export type PrioridadValor = Prioridad;
