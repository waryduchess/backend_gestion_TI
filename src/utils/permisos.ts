import { PERMISOS_DISPONIBLES, Permiso } from '../models/rol.model';

export const esPermisoValido = (valor: unknown): valor is Permiso =>
  typeof valor === 'string' &&
  (PERMISOS_DISPONIBLES as readonly string[]).includes(valor);

export const normalizarPermisos = (
  valor: unknown,
  contexto: string
): Permiso[] => {
  if (valor === null || valor === undefined) {
    return [];
  }

  if (!Array.isArray(valor) || !valor.every(esPermisoValido)) {
    throw new Error(`${contexto} contiene permisos invalidos`);
  }

  return valor;
};

export const calcularPermisosEfectivos = (
  permisosRol: Permiso[],
  permisosExtra: Permiso[],
  permisosRevocados: Permiso[]
): Permiso[] => {
  const revocados = new Set<Permiso>(permisosRevocados);
  const combinados = new Set<Permiso>([...permisosRol, ...permisosExtra]);
  return [...combinados].filter((permiso) => !revocados.has(permiso));
};
