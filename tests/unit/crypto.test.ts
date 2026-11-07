import { cifrar, descifrar } from '../../src/utils/crypto';

describe('cifrado AES-256-GCM', () => {
  it('cifra y descifra un texto conservando el contenido', () => {
    const texto = 'Clave secreta de NetSuite: abc-123';

    const cifrado = cifrar(texto);
    const descifrado = descifrar(cifrado);

    expect(cifrado).toMatch(/^enc:v1:/);
    expect(descifrado).toBe(texto);
  });

  it('genera un cifrado distinto para el mismo texto', () => {
    const texto = 'mismo contenido';

    expect(cifrar(texto)).not.toBe(cifrar(texto));
  });

  it('rechaza un valor con formato invalido', () => {
    expect(() => descifrar('texto-plano')).toThrow(
      'El valor cifrado no tiene un formato AES-GCM reconocido'
    );
  });

  it('rechaza un valor manipulado', () => {
    const cifrado = cifrar('contenido original');
    const partes = cifrado.split(':');
    partes[4] = `${partes[4].slice(0, -2)}00`;

    expect(() => descifrar(partes.join(':'))).toThrow();
  });

  it('exige una clave hexadecimal de 64 caracteres', () => {
    const claveOriginal = process.env.AES_SECRET_KEY;
    process.env.AES_SECRET_KEY = 'clave-corta';

    try {
      expect(() => cifrar('texto')).toThrow(
        'AES_SECRET_KEY debe contener una clave hexadecimal de 64 caracteres'
      );
    } finally {
      process.env.AES_SECRET_KEY = claveOriginal;
    }
  });
});
