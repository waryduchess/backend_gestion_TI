import { AccionAuditoriaSecreto } from '../generated/prisma/client';

export interface SecretoResumen {
  id: number;
  tipo: string | null;
  proyecto: string | null;
  nombre: string | null;
  usuario: string | null;
  comentario: string | null;
  activo: boolean;
}

export interface DatosCreacionSecreto {
  tipo: string | null;
  proyecto: string | null;
  nombre: string | null;
  usuario: string | null;
  password: string;
  comentario: string | null;
}

export interface DatosEdicionSecreto {
  tipo?: string | null;
  proyecto?: string | null;
  nombre?: string | null;
  usuario?: string | null;
  password?: string;
  comentario?: string | null;
  activo?: true;
}

export interface ParametrosListadoSecretos {
  page: number;
  limit: number;
  activo?: boolean;
  tipo?: string;
  proyecto?: string;
  q?: string;
}

export interface AuditoriaSecretoResumen {
  id: number;
  secretoId: number;
  accion: AccionAuditoriaSecreto;
  campos: string[] | null;
  realizadaEn: Date;
  usuario: {
    id: string;
    nombre: string;
  };
}

export interface ParametrosListadoAuditoria {
  secretoId: number;
  page: number;
  limit: number;
}

export interface MetadatosListadoSecretos {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
