import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANO_IV = 12;
const PREFIJO_CIFRADO = 'enc:v1';

const obtenerClave = (): Buffer => {
  const valor = process.env.AES_SECRET_KEY;
  if (!valor || !/^[\da-fA-F]{64}$/.test(valor)) {
    throw new Error(
      'AES_SECRET_KEY debe contener una clave hexadecimal de 64 caracteres'
    );
  }
  return Buffer.from(valor, 'hex');
};

export const cifrar = (texto: string): string => {
  const iv = randomBytes(TAMANO_IV);
  const cipher = createCipheriv(ALGORITMO, obtenerClave(), iv);
  const contenido = Buffer.concat([
    cipher.update(texto, 'utf8'),
    cipher.final(),
  ]);
  const etiqueta = cipher.getAuthTag();
  return [
    PREFIJO_CIFRADO,
    iv.toString('hex'),
    etiqueta.toString('hex'),
    contenido.toString('hex'),
  ].join(':');
};

export const descifrar = (textoCifrado: string): string => {
  const [prefijo, version, ivHex, etiquetaHex, contenidoHex, ...resto] =
    textoCifrado.split(':');
  if (
    `${prefijo}:${version}` !== PREFIJO_CIFRADO ||
    !ivHex ||
    !etiquetaHex ||
    contenidoHex === undefined ||
    resto.length > 0 ||
    !/^(?:[0-9a-f]{2})+$/i.test(ivHex) ||
    Buffer.from(ivHex, 'hex').length !== TAMANO_IV ||
    !/^(?:[0-9a-f]{2})+$/i.test(etiquetaHex) ||
    Buffer.from(etiquetaHex, 'hex').length !== 16 ||
    (contenidoHex !== '' && !/^(?:[0-9a-f]{2})+$/i.test(contenidoHex))
  ) {
    throw new Error('El valor cifrado no tiene un formato AES-GCM reconocido');
  }

  const decipher = createDecipheriv(
    ALGORITMO,
    obtenerClave(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(etiquetaHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(contenidoHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};
