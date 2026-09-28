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
