export const PERMISOS_DISPONIBLES = [
  'incidencias:leer',
  'incidencias:crear',
  'incidencias:editar',
  'notificaciones:leer',
  'dashboard:leer',
  'activos:leer',
  'activos:crear',
  'activos:editar',
  'activos:estado',
  'activos:asignar',
  'activos:eliminar',
  'mantenimiento:leer',
  'mantenimiento:crear',
  'mantenimiento:editar',
  'mantenimiento:eliminar',
  'recordatorios:leer',
  'recordatorios:crear',
  'recordatorios:editar',
  'recordatorios:eliminar',
  'proyectos:leer',
  'proyectos:crear',
  'proyectos:editar',
  'proyectos:eliminar',
  'proyectos:ver-todos',
  'adjuntos:subir',
  'adjuntos:leer',
  'adjuntos:eliminar',
  'usuarios:administrar',
  'roles:administrar',
  'catalogos:administrar',
  'licencias:administrar',
  'licencias:eliminar',
  'secretos:leer',
  'secretos:revelar',
  'secretos:administrar',
  'secretos:importar',
  'secretos:eliminar',
  'auditoria:leer',
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
