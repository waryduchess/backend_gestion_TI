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

export interface UsuarioResumen {
  id: string;
  nombre: string;
  email: string | null;
}
