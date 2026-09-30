import { MetadatosPaginacion } from './comun.model';

export interface UsuarioLista {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  departamento: CatalogoResumen | null;
  ubicacion: CatalogoResumen | null;
  puesto: CatalogoResumen | null;
  tipoUsuario: CatalogoResumen | null;
  rol: RolResumen | null;
}

export interface UsuarioDetalle {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  fechaInicio: Date | null;
  fechaFin: Date | null;
  departamento: CatalogoResumen | null;
  ubicacion: CatalogoResumen | null;
  puesto: CatalogoResumen | null;
  tipoUsuario: CatalogoResumen | null;
  rol: RolResumen | null;
}

export interface CatalogoResumen {
  id: number;
  nombre: string;
}

export interface RolResumen {
  id: number;
  nombre: string;
}

export interface DatosCreacionUsuario {
  id: string;
  nombre: string;
  email: string | null;
  password: string | null;
  departamentoId: number | null;
  ubicacionId: number | null;
  puestoId: number | null;
  tipoUsuarioId: number | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

export interface DatosEdicionUsuario {
  nombre?: string | null;
  email?: string | null;
  activo?: boolean;
  departamentoId?: number | null;
  ubicacionId?: number | null;
  puestoId?: number | null;
  tipoUsuarioId?: number | null;
  fechaInicio?: Date | null;
  fechaFin?: Date | null;
}

export interface ParametrosListadoUsuarios {
  page: number;
  limit: number;
  q?: string;
  departamentoId?: number;
  ubicacionId?: number;
  puestoId?: number;
  tipoUsuarioId?: number;
  activo?: boolean;
}

export interface ResultadoListadoUsuarios {
  usuarios: UsuarioLista[];
  meta: MetadatosPaginacion;
}
