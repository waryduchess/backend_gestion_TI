import {
  EstadoIncidencia,
  Prioridad,
} from '../generated/prisma/client';

export type TipoNotificacionValor =
  | 'INCIDENCIA_NUEVA'
  | 'LICENCIA_POR_VENCER';

export interface IncidenciaNotificacion {
  id: number;
  titulo: string;
  estado: EstadoIncidencia;
  prioridad: Prioridad;
  fechaNotificacion: Date;
}

export interface LicenciaNotificacion {
  id: number;
  software: string;
  proveedor: string | null;
  fechaVencimiento: Date;
}

export interface NotificacionLista {
  id: number;
  tipo: TipoNotificacionValor;
  incidenciaId: number | null;
  licenciaId: number | null;
  hitoDias: number | null;
  creadaEn: Date;
  leidaEn: Date | null;
  leida: boolean;
  incidencia: IncidenciaNotificacion | null;
  licencia: LicenciaNotificacion | null;
}

export interface ParametrosListadoNotificaciones {
  usuarioId: string;
  page: number;
  limit: number;
  leida?: boolean;
}

export interface ResultadoListadoNotificaciones {
  notificaciones: NotificacionLista[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    noLeidas: number;
  };
}
