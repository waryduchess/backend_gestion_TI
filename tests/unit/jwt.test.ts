import {
  firmarToken,
  obtenerExpiracionConfigurada,
  verificarToken,
} from '../../src/utils/jwt';

const usuario = {
  id: 'TEST-001',
  nombre: 'Usuario de Pruebas',
  email: 'usuario@pruebas.local',
};

describe('tokens JWT', () => {
  it('firma y verifica un token con los claims esperados', () => {
    const token = firmarToken(usuario);
    const payload = verificarToken(token);

    expect(payload.sub).toBe(usuario.id);
    expect(payload.nombre).toBe(usuario.nombre);
    expect(payload.email).toBe(usuario.email);
    expect(typeof payload.exp).toBe('number');
  });

  it('rechaza un token con firma invalida', () => {
    const token = firmarToken(usuario);

    expect(() => verificarToken(`${token}firma-alterada`)).toThrow();
  });

  it('rechaza un token expirado', () => {
    const expiracionOriginal = process.env.JWT_EXPIRES_IN;
    process.env.JWT_EXPIRES_IN = '-1s';

    try {
      const token = firmarToken(usuario);
      expect(() => verificarToken(token)).toThrow();
    } finally {
      process.env.JWT_EXPIRES_IN = expiracionOriginal;
    }
  });

  it('expone la expiracion configurada o el valor por defecto', () => {
    const expiracionOriginal = process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_EXPIRES_IN;

    try {
      expect(obtenerExpiracionConfigurada()).toBe('8h');
    } finally {
      process.env.JWT_EXPIRES_IN = expiracionOriginal;
    }
  });
});
