import { EstadoActivo } from '../generated/prisma/client';

export const LIMITE_FILAS_IMPORTACION = 500;

export const COLUMNAS_IMPORTACION = {
  cb23: 'CB23',
  tipo: 'Tipo',
  marca: 'Marca',
  modelo: 'Modelo',
  numeroSerie: 'Número de serie',
  sucursal: 'Sucursal',
  estado: 'Estado',
  estadoGeneral: 'Estado general',
  nombreRed: 'Red',
  correoResponsable: 'Correo responsable',
} as const;

export type FilaImportacionCruda = Record<string, unknown>;

export interface DatosFilaImportada {
  tipo: string;
  cb23: string | null;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  sucursal: string | null;
  estadoGeneral: string | null;
  nombreRed: string | null;
  estado: EstadoActivo;
  responsableId: string | null;
}

export interface ResultadoFilaImportacion {
  fila: number;
  valido: boolean;
  errores: string[];
  advertencias: string[];
  datos: DatosFilaImportada | null;
}

export interface ResumenValidacionImportacion {
  total: number;
  validas: number;
  invalidas: number;
}

export interface ResultadoValidacionImportacion {
  resumen: ResumenValidacionImportacion;
  filas: ResultadoFilaImportacion[];
}

export interface FilaConfirmacionImportacion {
  fila: number;
  creado: boolean;
  activoId: number | null;
  errores: string[];
  advertencias: string[];
}

export interface ResumenConfirmacionImportacion {
  total: number;
  creadas: number;
  rechazadas: number;
}

export interface ResultadoConfirmacionImportacion {
  resumen: ResumenConfirmacionImportacion;
  filas: FilaConfirmacionImportacion[];
}
