import {
  calcularPermisosEfectivos,
  esPermisoValido,
  normalizarPermisos,
} from '../../src/utils/permisos';

describe('utilidades de permisos', () => {
  it('reconoce permisos validos y rechaza valores desconocidos', () => {
    expect(esPermisoValido('incidencias:leer')).toBe(true);
    expect(esPermisoValido('incidencias:eliminar')).toBe(false);
    expect(esPermisoValido(123)).toBe(false);
  });

  it('normaliza ausencia de permisos como arreglo vacio', () => {
    expect(normalizarPermisos(undefined, 'rol')).toEqual([]);
    expect(normalizarPermisos(null, 'rol')).toEqual([]);
  });

  it('rechaza arreglos con permisos invalidos', () => {
    expect(() =>
      normalizarPermisos(['incidencias:leer', 'inventado:todo'], 'rol')
    ).toThrow('rol contiene permisos invalidos');
  });

  it('calcula permisos efectivos aplicando extras y revocados', () => {
    const resultado = calcularPermisosEfectivos(
      ['incidencias:leer', 'incidencias:crear'],
      ['incidencias:editar', 'incidencias:crear'],
      ['incidencias:leer']
    );

    expect(resultado).toEqual(['incidencias:crear', 'incidencias:editar']);
  });

  it('no duplica permisos repetidos', () => {
    const resultado = calcularPermisosEfectivos(
      ['dashboard:leer', 'dashboard:leer'],
      [],
      []
    );

    expect(resultado).toEqual(['dashboard:leer']);
  });
});
