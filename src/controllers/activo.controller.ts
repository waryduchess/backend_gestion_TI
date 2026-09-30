import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoTexto, validarCampoOpcion, validarOpcion } from '../utils/validacion';
import {
  ESTADOS_DE_ACTIVO,
  crear,
  actualizar,
  cambiarEstado,
  asignar,
  eliminar,
  listar,
  obtenerPorId,
} from '../services/activo.service';
import {
  ActivoDetalle,
  ActivoResumen,
  DatosAsignacionActivo,
  DatosCreacionActivo,
  DatosEdicionActivo,
  ParametrosListadoActivos,
} from '../models/activo.model';
import { RespuestaPaginada } from '../models/comun.model';

const LIMITE_MAXIMO = 100;

export const listarActivos = asyncHandler(
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

    const estado = validarOpcion(req.query.estado, 'estado', ESTADOS_DE_ACTIVO);

    const parametros: ParametrosListadoActivos = {
      page,
      limit,
      ...(estado ? { estado: estado as (typeof ESTADOS_DE_ACTIVO)[number] } : {}),
      ...(comoTexto(req.query.tipo) ? { tipo: comoTexto(req.query.tipo) } : {}),
      ...(comoTexto(req.query.sucursal)
        ? { sucursal: comoTexto(req.query.sucursal) }
        : {}),
      ...(comoTexto(req.query.responsableId)
        ? { responsableId: comoTexto(req.query.responsableId) }
        : {}),
      ...(comoTexto(req.query.q) ? { q: comoTexto(req.query.q) } : {}),
    };

    const { activos, meta } = await listar(parametros);

    const respuesta: RespuestaPaginada<ActivoResumen> = {
      success: true,
      message: 'Activos obtenidos correctamente',
      errors: [],
      data: activos,
      meta,
    };

    res.status(200).json(respuesta);
  }
);

export const obtenerActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const activo: ActivoDetalle = await obtenerPorId(Number(textoId));

    res.status(200).json({
      success: true,
      message: 'Activo obtenido correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const crearActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const tipo = comoTexto(cuerpo.tipo);

    if (tipo === '') {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        { campo: 'tipo', valor: '', mensaje: 'El tipo es obligatorio' },
      ]);
    }

    const estado = validarCampoOpcion(cuerpo.estado, 'estado', ESTADOS_DE_ACTIVO);

    const texto = (campo: string): string | null => {
      const valor = comoTexto(cuerpo[campo]);
      return valor === '' ? null : valor;
    };

    const responsableId = texto('responsableId');

    const datos: DatosCreacionActivo = {
      tipo,
      claveActivo: texto('claveActivo'),
      cb23: texto('cb23'),
      marca: texto('marca'),
      modelo: texto('modelo'),
      numeroParte: texto('numeroParte'),
      numeroSerie: texto('numeroSerie'),
      sucursal: texto('sucursal'),
      anydesk: texto('anydesk'),
      nombreRed: texto('nombreRed'),
      procesador: texto('procesador'),
      memoria: texto('memoria'),
      estadoGeneral: texto('estadoGeneral'),
      notas: texto('notas'),
      ...(estado
        ? { estado: estado as (typeof ESTADOS_DE_ACTIVO)[number] }
        : {}),
      ...(responsableId ? { responsableId } : {}),
    };

    const activo: ActivoDetalle = await crear(datos);

    res.status(201).json({
      success: true,
      message: 'Activo creado correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const actualizarActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const id = Number(textoId);
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;

    if ('estado' in cuerpo) {
      throw new HttpError(
        400,
        'El campo "estado" no se puede editar aqui; use PATCH /api/activos/:id/estado',
        [{ campo: 'estado', valor: comoTexto(cuerpo.estado) || null }]
      );
    }

    const presente = (campo: string): boolean => campo in cuerpo;
    const comoValor = (campo: string): string | null => {
      const texto = comoTexto(cuerpo[campo]);
      return texto === '' ? null : texto;
    };

    const datos: DatosEdicionActivo = {};
    let camposRecibidos = 0;

    if (presente('tipo')) {
      const tipo = comoTexto(cuerpo.tipo);

      if (tipo === '') {
        throw new HttpError(400, 'Faltan campos obligatorios', [
          { campo: 'tipo', valor: '', mensaje: 'El tipo es obligatorio' },
        ]);
      }

      datos.tipo = tipo;
      camposRecibidos += 1;
    }

    if (presente('claveActivo')) {
      datos.claveActivo = comoValor('claveActivo');
      camposRecibidos += 1;
    }

    if (presente('cb23')) {
      datos.cb23 = comoValor('cb23');
      camposRecibidos += 1;
    }

    if (presente('marca')) {
      datos.marca = comoValor('marca');
      camposRecibidos += 1;
    }

    if (presente('modelo')) {
      datos.modelo = comoValor('modelo');
      camposRecibidos += 1;
    }

    if (presente('numeroParte')) {
      datos.numeroParte = comoValor('numeroParte');
      camposRecibidos += 1;
    }

    if (presente('numeroSerie')) {
      datos.numeroSerie = comoValor('numeroSerie');
      camposRecibidos += 1;
    }

    if (presente('sucursal')) {
      datos.sucursal = comoValor('sucursal');
      camposRecibidos += 1;
    }

    if (presente('anydesk')) {
      datos.anydesk = comoValor('anydesk');
      camposRecibidos += 1;
    }

    if (presente('nombreRed')) {
      datos.nombreRed = comoValor('nombreRed');
      camposRecibidos += 1;
    }

    if (presente('procesador')) {
      datos.procesador = comoValor('procesador');
      camposRecibidos += 1;
    }

    if (presente('memoria')) {
      datos.memoria = comoValor('memoria');
      camposRecibidos += 1;
    }

    if (presente('estadoGeneral')) {
      datos.estadoGeneral = comoValor('estadoGeneral');
      camposRecibidos += 1;
    }

    if (presente('notas')) {
      datos.notas = comoValor('notas');
      camposRecibidos += 1;
    }

    if (presente('responsableId')) {
      datos.responsableId = comoValor('responsableId');
      camposRecibidos += 1;
    }

    if (camposRecibidos === 0) {
      throw new HttpError(400, 'No se recibio ningun campo para actualizar', []);
    }

    const activo: ActivoDetalle = await actualizar(id, datos);

    res.status(200).json({
      success: true,
      message: 'Activo actualizado correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const cambiarEstadoActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const estado = validarCampoOpcion(cuerpo.estado, 'estado', ESTADOS_DE_ACTIVO);

    if (!estado) {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        { campo: 'estado', valor: '', mensaje: 'El estado es obligatorio' },
      ]);
    }

    const activo: ActivoDetalle = await cambiarEstado(
      Number(textoId),
      estado as (typeof ESTADOS_DE_ACTIVO)[number]
    );

    res.status(200).json({
      success: true,
      message: 'Estado del activo actualizado correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const asignarActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const usuarioId = comoTexto(cuerpo.usuarioId);

    if (usuarioId === '') {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        { campo: 'usuarioId', valor: '', mensaje: 'El usuario es obligatorio' },
      ]);
    }

    let anioCompra: number | null = null;

    if (cuerpo.anioCompra !== undefined && cuerpo.anioCompra !== null) {
      const textoAnio =
        typeof cuerpo.anioCompra === 'number'
          ? String(cuerpo.anioCompra)
          : comoTexto(cuerpo.anioCompra);

      if (!/^\d+$/.test(textoAnio)) {
        throw new HttpError(400, 'El campo "anioCompra" debe ser un numero entero', [
          { campo: 'anioCompra', valor: textoAnio || String(cuerpo.anioCompra) },
        ]);
      }

      anioCompra = Number(textoAnio);
    }

    const comoValor = (campo: string): string | null => {
      const valor = comoTexto(cuerpo[campo]);
      return valor === '' ? null : valor;
    };

    const datos: DatosAsignacionActivo = {
      usuarioId,
      anioCompra,
      numeroActivo: comoValor('numeroActivo'),
      nombreEquipo: comoValor('nombreEquipo'),
      bitlocker: comoValor('bitlocker'),
      observacion: comoValor('observacion'),
    };

    const activo: ActivoDetalle = await asignar(Number(textoId), datos);

    res.status(201).json({
      success: true,
      message: 'Activo asignado correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const eliminarActivo = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const activo: ActivoDetalle = await eliminar(Number(textoId));

    res.status(200).json({
      success: true,
      message: 'Activo dado de baja correctamente',
      errors: [],
      data: activo,
    });
  }
);
