import { HttpError } from '../middlewares/error.middleware';

export const comoTexto = (valor: unknown): string =>
  typeof valor === 'string' ? valor.trim() : '';

export const comoEntero = (
  valor: unknown,
  nombre: string,
  porDefecto: number
): number => {
  const texto = comoTexto(valor);

  if (texto === '') {
    return porDefecto;
  }

  if (!/^\d+$/.test(texto)) {
    throw new HttpError(400, `El parametro "${nombre}" debe ser un numero entero`, [
      { campo: nombre, valor: texto },
    ]);
  }

  return Number(texto);
};

export const validarOpcion = (
  valor: unknown,
  nombre: string,
  permitidos: string[]
): string | undefined => {
  const texto = comoTexto(valor);

  if (texto === '') {
    return undefined;
  }

  if (!permitidos.includes(texto)) {
    throw new HttpError(400, `El parametro "${nombre}" no tiene un valor valido`, [
      { campo: nombre, valor: texto, permitidos },
    ]);
  }

  return texto;
};

export const validarCampoOpcion = (
  valor: unknown,
  campo: string,
  permitidos: string[]
): string | undefined => {
  const texto = comoTexto(valor);

  if (texto === '') {
    return undefined;
  }

  if (!permitidos.includes(texto)) {
    throw new HttpError(400, `El campo "${campo}" no tiene un valor valido`, [
      { campo, valor: texto, permitidos },
    ]);
  }

  return texto;
};

export const comoFecha = (valor: unknown, nombre: string): Date | null => {
  const texto = comoTexto(valor);

  if (texto === '') {
    return null;
  }

  const fecha = new Date(texto);

  if (Number.isNaN(fecha.getTime())) {
    throw new HttpError(400, `El campo "${nombre}" debe ser una fecha valida`, [
      { campo: nombre, valor: texto },
    ]);
  }

  return fecha;
};
