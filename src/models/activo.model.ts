import { EstadoActivo } from '../generated/prisma/client';
import { MetadatosPaginacion, UsuarioResumen } from './comun.model';

export interface ActivoResumen {
  id: number;
  claveActivo: string | null;
  cb23: string | null;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  sucursal: string | null;
  estado: EstadoActivo;
  estadoGeneral: string | null;
  nombreRed: string | null;
  responsable: UsuarioResumen | null;
}

export interface AsignacionResumen {
  id: number;
  activa: boolean;
  fechaAsignacion: Date;
  usuario: UsuarioResumen;
}

export interface ActivoDetalle extends ActivoResumen {
  numeroParte: string | null;
  anydesk: string | null;
  procesador: string | null;
  memoria: string | null;
  notas: string | null;
  asignaciones: AsignacionResumen[];
}

export interface ParametrosListadoActivos {
  page: number;
  limit: number;
  tipo?: string;
  estado?: EstadoActivo;
  sucursal?: string;
  responsableId?: string;
  q?: string;
}

export interface ResultadoListadoActivos {
  activos: ActivoResumen[];
  meta: MetadatosPaginacion;
}

export interface DatosCreacionActivo {
  tipo: string;
  claveActivo: string | null;
  cb23: string | null;
  marca: string | null;
  modelo: string | null;
  numeroParte: string | null;
  numeroSerie: string | null;
  sucursal: string | null;
  anydesk: string | null;
  nombreRed: string | null;
  procesador: string | null;
  memoria: string | null;
  estadoGeneral: string | null;
  notas: string | null;
  estado?: EstadoActivo;
  responsableId?: string;
}

export interface DatosEdicionActivo {
  tipo?: string;
  claveActivo?: string | null;
  cb23?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroParte?: string | null;
  numeroSerie?: string | null;
  sucursal?: string | null;
  anydesk?: string | null;
  nombreRed?: string | null;
  procesador?: string | null;
  memoria?: string | null;
  estadoGeneral?: string | null;
  notas?: string | null;
  responsableId?: string | null;
}

export interface DatosAsignacionActivo {
  usuarioId: string;
  anioCompra: number | null;
  numeroActivo: string | null;
  nombreEquipo: string | null;
  bitlocker: string | null;
  observacion: string | null;
}

export interface AsignacionLista {
  id: number;
  activa: boolean;
  fechaAsignacion: Date;
  fechaDevolucion: Date | null;
  anioCompra: number | null;
  numeroActivo: string | null;
  nombreEquipo: string | null;
  observacion: string | null;
  usuario: UsuarioResumen;
  activo: {
    id: number;
    claveActivo: string | null;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    numeroSerie: string | null;
    estado: EstadoActivo;
  };
}

export interface ParametrosListadoAsignaciones {
  page: number;
  limit: number;
  activa?: boolean;
  usuarioId?: string;
  activoId?: number;
  q?: string;
}

export interface ResultadoListadoAsignaciones {
  asignaciones: AsignacionLista[];
  meta: MetadatosPaginacion;
}
