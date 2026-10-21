import { EntidadAdjunto } from '../generated/prisma/client';
import { MetadatosPaginacion } from './comun.model';

export const ENTIDADES_ADJUNTO = [
  'ACTIVO',
  'MANTENIMIENTO',
  'INCIDENCIA',
  'PROYECTO',
] as const;

export interface ArchivoImagen {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface DatosCreacionAdjunto {
  entidadTipo: EntidadAdjunto;
  entidadId: string;
  archivo: ArchivoImagen;
}

export interface AdjuntoResumen {
  id: number;
  entidadTipo: EntidadAdjunto;
  entidadId: string;
  nombreOriginal: string;
  mimeType: string;
  extension: string;
  tamano: number;
  subidoEn: Date;
}

export interface ParametrosListadoAdjuntos {
  page: number;
  limit: number;
  entidadTipo: EntidadAdjunto;
  entidadId: string;
}

export interface ResultadoListadoAdjuntos {
  adjuntos: AdjuntoResumen[];
  meta: MetadatosPaginacion;
}

export interface DescargaAdjunto {
  url: string;
  expiraEn: string;
}
