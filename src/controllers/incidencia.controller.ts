import { Request, Response } from 'express';
import {
  ESTADOS_VALIDOS,
  PRIORIDADES_VALIDAS,
  TIPOS_REQUERIMIENTO_VALIDOS,
  DatosCreacionIncidencia,
  EstadoIncidenciaValor,
  PrioridadValor,
  IncidenciaLista,
  ParametrosListadoIncidencias,
  RespuestaPaginada,
} from '../models/incidencia.model';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { listar, obtenerPorId, crear } from '../services/incidencia.service';
import { TipoRequerimiento } from '../generated/prisma/client';
import { validarCampoOpcion } from '../utils/validacion';

const LIMITE_MAXIMO = 100;

const obtenerIdIncidencia = (valor: unknown): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, 'El parametro "id" debe ser un numero entero positivo', [
      { campo: 'id', valor: typeof valor === 'string' ? valor : undefined },
    ]);
  }

  const id = Number(valor);
  if (!Number.isSafeInteger(id)) {
    throw new HttpError(400, 'El parametro "id" debe ser un numero entero positivo', [
      { campo: 'id', valor },
    ]);
  }
  return id;
};

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

const leerTextoObligatorio = (
  cuerpo: Record<string, unknown>,
  campo: 'titulo' | 'descripcion' | 'tipoRequerimiento'
): string => {
  const valor = cuerpo[campo];
  if (valor === undefined || valor === null || valor === '') {
    throw new HttpError(400, 'Faltan campos obligatorios', [
      { campo, valor: valor ?? '', mensaje: `El campo "${campo}" es obligatorio` },
    ]);
  }
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El campo "${campo}" debe ser texto`, [
      { campo, valor },
    ]);
  }

  const texto = valor.trim();
  if (texto === '') {
    throw new HttpError(400, 'Faltan campos obligatorios', [
      { campo, valor: texto, mensaje: `El campo "${campo}" es obligatorio` },
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

export const obtenerIncidencia = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = obtenerIdIncidencia(req.params.id);
    const incidencia = await obtenerPorId(id);

    res.status(200).json({
      success: true,
      message: 'Incidencia obtenida correctamente',
      errors: [],
      data: incidencia,
    });
  }
);

export const crearIncidencia = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const usuario = req.usuario;
    if (!usuario) {
      throw new HttpError(401, 'Autenticacion requerida');
    }

    if (
      typeof req.body !== 'object' ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      throw new HttpError(400, 'El cuerpo debe ser un objeto JSON');
    }

    const cuerpo = req.body as Record<string, unknown>;
    const camposPermitidos = new Set([
      'titulo',
      'descripcion',
      'tipoRequerimiento',
      'departamentoId',
    ]);
    const camposDesconocidos = Object.keys(cuerpo).filter(
      (campo) => !camposPermitidos.has(campo)
    );
    if (camposDesconocidos.length > 0) {
      throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
        { campo: 'campos', valor: camposDesconocidos },
      ]);
    }

    const titulo = leerTextoObligatorio(cuerpo, 'titulo');
    if (titulo.length > 500) {
      throw new HttpError(400, 'El campo "titulo" no puede exceder 500 caracteres', [
        { campo: 'titulo', valor: titulo },
      ]);
    }
    const descripcion = leerTextoObligatorio(cuerpo, 'descripcion');
    const tipoRecibido = leerTextoObligatorio(cuerpo, 'tipoRequerimiento');
    const tipoRequerimiento = validarCampoOpcion(
      tipoRecibido,
      'tipoRequerimiento',
      TIPOS_REQUERIMIENTO_VALIDOS
    );
    if (!tipoRequerimiento) {
      throw new HttpError(400, 'El campo "tipoRequerimiento" no tiene un valor valido', [
        { campo: 'tipoRequerimiento', valor: tipoRecibido },
      ]);
    }

    let departamentoId: number | null = null;
    const departamentoRecibido = cuerpo.departamentoId;
    if (departamentoRecibido !== undefined && departamentoRecibido !== null) {
      if (
        typeof departamentoRecibido !== 'number' ||
        !Number.isSafeInteger(departamentoRecibido) ||
        departamentoRecibido < 1 ||
        departamentoRecibido > 2147483647
      ) {
        throw new HttpError(400, 'El campo "departamentoId" debe ser un entero positivo', [
          { campo: 'departamentoId', valor: departamentoRecibido },
        ]);
      }
      departamentoId = departamentoRecibido;
    }

    const datos: DatosCreacionIncidencia = {
      titulo,
      descripcion,
      tipoRequerimiento: tipoRequerimiento as TipoRequerimiento,
      departamentoId,
      solicitanteId: usuario.id,
    };
    const incidencia = await crear(datos);

    res.status(201).json({
      success: true,
      message: 'Incidencia creada correctamente',
      errors: [],
      data: incidencia,
    });
  }
);
