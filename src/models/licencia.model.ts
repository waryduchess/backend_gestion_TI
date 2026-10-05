import { UsuarioResumen } from './comun.model';

export interface LicenciaResumen {
  id: number;
  software: string;
  tieneClave: boolean;
  proveedor: string | null;
  fechaCompra: Date | null;
  fechaVencimiento: Date;
  activa: boolean;
  asignadaA: UsuarioResumen | null;
}

export interface ParametrosListadoLicencias {
  page: number;
  limit: number;
  activa?: boolean;
  proveedor?: string;
  venceDesde?: Date;
  venceHasta?: Date;
  q?: string;
}

export interface DatosCreacionLicencia {
  software: string;
  clave: string | null;
  proveedor: string | null;
  fechaCompra: Date | null;
  fechaVencimiento: Date;
  asignadaAId: string | null;
}

export interface DatosEdicionLicencia {
  software?: string;
  clave?: string | null;
  proveedor?: string | null;
  fechaCompra?: Date | null;
  fechaVencimiento?: Date;
  asignadaAId?: string | null;
  activa?: boolean;
}
