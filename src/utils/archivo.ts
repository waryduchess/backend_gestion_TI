import { randomUUID } from 'node:crypto';
import path from 'node:path';

const MIME_PREDETERMINADOS = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

const tamanoConfigurado = Number(process.env.S3_MAX_SIZE_BYTES);
export const TAMANO_MAXIMO_IMAGEN =
  Number.isSafeInteger(tamanoConfigurado) && tamanoConfigurado > 0
    ? tamanoConfigurado
    : 10 * 1024 * 1024;

const mimesConfigurados = (process.env.S3_ALLOWED_IMAGE_MIME ?? '')
  .split(',')
  .map((mime) => mime.trim().toLowerCase())
  .filter(Boolean);

export const MIMES_IMAGEN_PERMITIDOS = new Set(
  mimesConfigurados.length > 0 ? mimesConfigurados : MIME_PREDETERMINADOS
);

export const EXTENSION_POR_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export const esMimeImagenPermitido = (mime: string): boolean =>
  MIMES_IMAGEN_PERMITIDOS.has(mime.toLowerCase());

export const validarFirmaImagen = (mime: string, buffer: Buffer): boolean => {
  if (buffer.length === 0) return false;

  if (mime === 'image/png') {
    const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return firma.every((byte, indice) => buffer[indice] === byte);
  }

  if (mime === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }

  if (mime === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }

  return false;
};

export const crearClaveAdjunto = (
  entidadTipo: string,
  entidadId: string,
  mime: string
): string => {
  const extension = EXTENSION_POR_MIME[mime.toLowerCase()] ?? '.bin';
  return `${entidadTipo.toLowerCase()}/${entidadId}/${randomUUID()}${extension}`;
};

export const nombreArchivoSeguro = (nombre: string): string => {
  const base = path.basename(nombre).replace(/[^\w.\- ()]/g, '_').trim();
  return (base || 'imagen').slice(0, 255);
};
