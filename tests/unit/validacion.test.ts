import { HttpError } from '../../src/middlewares/error.middleware';
import {
  comoEntero,
  comoFecha,
  comoTexto,
  validarCampoOpcion,
  validarOpcion,
} from '../../src/utils/validacion';

describe('utilidades de validacion', () => {
  it('convierte textos y recorta espacios', () => {
    expect(comoTexto('  hola  ')).toBe('hola');
    expect(comoTexto(10)).toBe('');
  });

  it('convierte enteros y usa el valor por defecto', () => {
    expect(comoEntero('15', 'page', 1)).toBe(15);
    expect(comoEntero('', 'page', 1)).toBe(1);
  });

  it('rechaza enteros invalidos con HttpError 400', () => {
    try {
      comoEntero('1.5', 'page', 1);
      throw new Error('No se lanzo el error esperado');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).statusCode).toBe(400);
    }
  });

  it('valida opciones permitidas y devuelve undefined si esta vacio', () => {
    expect(validarOpcion('NUEVO', 'estado', ['NUEVO', 'COMPLETADO'])).toBe(
      'NUEVO'
    );
    expect(validarOpcion('', 'estado', ['NUEVO'])).toBeUndefined();
    expect(() => validarOpcion('INVALIDO', 'estado', ['NUEVO'])).toThrow(
      HttpError
    );
  });

  it('valida campos de opcion permitidos', () => {
    expect(
      validarCampoOpcion('ALTA', 'prioridad', ['BAJA', 'ALTA'])
    ).toBe('ALTA');
    expect(() =>
      validarCampoOpcion('URGENTE', 'prioridad', ['BAJA', 'ALTA'])
    ).toThrow(HttpError);
  });

  it('convierte fechas y rechaza valores invalidos', () => {
    const fecha = comoFecha('2026-11-02', 'fechaInicio');

    expect(fecha).toBeInstanceOf(Date);
    expect(fecha?.toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(comoFecha('', 'fechaInicio')).toBeNull();
    expect(() => comoFecha('no-es-fecha', 'fechaInicio')).toThrow(HttpError);
  });
});
