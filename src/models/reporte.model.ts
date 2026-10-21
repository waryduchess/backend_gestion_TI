import { EstadoReporteGenerado } from '../generated/prisma/client';
import { UsuarioAuth } from './auth.model';
import { Permiso } from './rol.model';

export type FormatoReporte = 'xlsx' | 'pdf' | 'csv';

export interface ReporteFiltroDefinicion {
  nombre: string;
  tipo: 'texto' | 'enum' | 'fecha' | 'booleano';
  descripcion: string;
  opciones?: string[];
}

export interface ReporteColumna {
  clave: string;
  encabezado: string;
  ancho?: number;
}

export interface ReporteSeccion {
  nombre: string;
  columnas: ReporteColumna[];
  filas: Record<string, unknown>[];
  totales?: Record<string, unknown>;
}

export interface ReporteDocumento {
  titulo: string;
  subtitulo?: string;
  generadoEn: Date;
  generadoPor: string;
  metadatos: Record<string, string>;
  secciones: ReporteSeccion[];
}

export interface ReporteDefinicion {
  codigo: string;
  nombre: string;
  descripcion: string;
  modulo: string;
  formatos: FormatoReporte[];
  permisos: Permiso[];
  filtros: ReporteFiltroDefinicion[];
  maxFilas: number;
  validarFiltros: (query: Record<string, unknown>) => Record<string, unknown>;
  cargar: (
    filtros: Record<string, unknown>,
    usuario: UsuarioAuth
  ) => Promise<ReporteDocumento>;
}

export interface ReporteMetadata {
  codigo: string;
  nombre: string;
  descripcion: string;
  modulo: string;
  formatos: FormatoReporte[];
  permisos: Permiso[];
  filtros: ReporteFiltroDefinicion[];
  maxFilas: number;
}

export interface ReporteDescarga {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface ReporteGeneracionResumen {
  id: number;
  codigo: string;
  formato: FormatoReporte;
  parametros: Record<string, unknown> | null;
  estado: EstadoReporteGenerado;
  error: string | null;
  nombreArchivo: string | null;
  tamano: number | null;
  creadoEn: Date;
  iniciadoEn: Date | null;
  terminadoEn: Date | null;
}

export interface ParametrosListadoGeneraciones {
  page: number;
  limit: number;
}

export interface ResultadoListadoGeneraciones {
  generaciones: ReporteGeneracionResumen[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DescargaReporteGenerado {
  url: string;
  expiraEn: string;
}

export interface ReporteProgramadoResumen {
  id: number;
  codigo: string;
  formato: FormatoReporte;
  parametros: Record<string, unknown> | null;
  cron: string;
  destinatarios: string[];
  activo: boolean;
  usuarioId: string;
  ultimaEjecucion: Date | null;
  ultimoEstado: string | null;
  ultimoError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionProgramacion {
  codigo: string;
  formato: FormatoReporte;
  parametros: Record<string, unknown>;
  cron: string;
  destinatarios: string[];
}

export interface DatosEdicionProgramacion {
  formato?: FormatoReporte;
  parametros?: Record<string, unknown>;
  cron?: string;
  destinatarios?: string[];
  activo?: boolean;
}

export interface ParametrosListadoProgramaciones {
  page: number;
  limit: number;
}

export interface ResultadoListadoProgramaciones {
  programaciones: ReporteProgramadoResumen[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
