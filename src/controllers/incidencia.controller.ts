import { Request, Response } from 'express';
import {
  ESTADOS_VALIDOS,
  PRIORIDADES_VALIDAS,
  EstadoIncidenciaValor,
  PrioridadValor,
  IncidenciaLista,
  ParametrosListadoIncidencias,
  RespuestaPaginada,
} from '../models/incidencia.model';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listar } from '../services/incidencia.service';

const LIMITE_MAXIMO = 100;

const comoTexto = (valor: unknown): string | undefined =>
  typeof valor === 'string' ? valor : undefined;

const comoEntero = (
  valor: unknown,
  nombre: string,
  porDefecto: number
): number => {
  const texto = comoTexto(valor);
  if (texto === undefined || texto === '') {
    return porDefecto;
  }
  if (!/^\d+$/.test(texto)) {
    throw new HttpError(400, `El parametro "${nombre}" debe ser un numero entero`, [
      { campo: nombre, valor: texto },
    ]);
  }
  return Number(texto);
};

const validarOpcion = (
  valor: unknown,
  nombre: string,
  permitidos: string[]
): string | undefined => {
  const texto = comoTexto(valor);
  if (texto === undefined || texto === '') {
    return undefined;
  }
  if (!permitidos.includes(texto)) {
    throw new HttpError(400, `El parametro "${nombre}" no tiene un valor valido`, [
      { campo: nombre, valor: texto, permitidos },
    ]);
  }
  return texto;
};

export const listarIncidencias = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = comoEntero(req.query.page, 'page', 1);
    const limit = comoEntero(req.query.limit, 'limit', 10);

    if (page < 1) {
      throw new HttpError(400, 'El parametro "page" debe ser mayor o igual a 1', [
        { campo: 'page', valor: String(page) },
      ]);
    }

    if (limit < 1 || limit > LIMITE_MAXIMO) {
      throw new HttpError(
        400,
        `El parametro "limit" debe estar entre 1 y ${LIMITE_MAXIMO}`,
        [{ campo: 'limit', valor: String(limit) }]
      );
    }

    const estado = validarOpcion(req.query.estado, 'estado', ESTADOS_VALIDOS);
    const prioridad = validarOpcion(
      req.query.prioridad,
      'prioridad',
      PRIORIDADES_VALIDAS
    );

    const parametros: ParametrosListadoIncidencias = {
      page,
      limit,
      estado: estado as EstadoIncidenciaValor | undefined,
      prioridad: prioridad as PrioridadValor | undefined,
    };

    const { incidencias, meta } = await listar(parametros);

    const respuesta: RespuestaPaginada<IncidenciaLista> = {
      success: true,
      message: 'Incidencias obtenidas correctamente',
      errors: [],
      data: incidencias,
      meta,
    };

    res.status(200).json(respuesta);
  }
);
