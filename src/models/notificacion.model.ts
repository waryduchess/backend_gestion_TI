import {
  EstadoIncidencia,
  Prioridad,
} from '../generated/prisma/client';

export interface IncidenciaNotificacion {
  id: number;
  titulo: string;
  estado: EstadoIncidencia;
  prioridad: Prioridad;
  fechaNotificacion: Date;
}

export interface NotificacionLista {
  id: number;
  incidenciaId: number;
  creadaEn: Date;
  leidaEn: Date | null;
  leida: boolean;
  incidencia: IncidenciaNotificacion;
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
