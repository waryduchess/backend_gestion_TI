export const PERMISOS_DISPONIBLES = [
  'incidencias:leer',
  'incidencias:crear',
  'notificaciones:leer',
  'dashboard:leer',
  'activos:leer',
  'activos:crear',
  'activos:editar',
  'activos:estado',
  'activos:asignar',
  'activos:eliminar',
  'usuarios:administrar',
  'roles:administrar',
  'catalogos:administrar',
  'licencias:administrar',
  'secretos:leer',
  'secretos:revelar',
  'secretos:administrar',
] as const;

export type Permiso = (typeof PERMISOS_DISPONIBLES)[number];

export interface Rol {
  id: number;
  nombre: string;
  permisos: Permiso[];
  activo: boolean;
}

export interface DatosCreacionRol {
  nombre: string;
  permisos: Permiso[];
}

export interface DatosEdicionRol {
  nombre?: string;
  permisos?: Permiso[];
  activo?: true;
}
