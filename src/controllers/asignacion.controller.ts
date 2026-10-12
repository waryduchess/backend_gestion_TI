import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoTexto, validarOpcion } from '../utils/validacion';
import {
  devolver,
  editarAsignacion as editarAsignacionService,
  eliminarAsignacion as eliminarAsignacionService,
  listarAsignaciones as obtenerListado,
} from '../services/activo.service';
import {
  ActivoDetalle,
  AsignacionLista,
  DatosEdicionAsignacion,
  ParametrosListadoAsignaciones,
} from '../models/activo.model';
import { RespuestaPaginada } from '../models/comun.model';

const LIMITE_MAXIMO = 100;

const CAMPOS_EDITABLES_ASIGNACION = new Set([
  'anioCompra',
  'numeroActivo',
  'nombreEquipo',
  'bitlocker',
  'observacion',
]);

const leerIdAsignacion = (valor: unknown): number => {
  const textoId = comoTexto(valor);

  if (!/^\d+$/.test(textoId)) {
    throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
      { campo: 'id', valor: textoId },
    ]);
  }

  return Number(textoId);
};

export const devolverAsignacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const activo: ActivoDetalle = await devolver(leerIdAsignacion(req.params.id));

    res.status(200).json({
      success: true,
      message: 'Asignacion devuelta correctamente',
      errors: [],
      data: activo,
    });
  }
);

export const listarAsignaciones = asyncHandler(
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

    const activaTexto = validarOpcion(req.query.activa, 'activa', ['true', 'false']);
    const activa = activaTexto === undefined ? undefined : activaTexto === 'true';

    const activoIdTexto = comoTexto(req.query.activoId);
    const activoId =
      activoIdTexto === '' ? undefined : comoEntero(activoIdTexto, 'activoId', 1);

    const parametros: ParametrosListadoAsignaciones = {
      page,
      limit,
      ...(activa !== undefined ? { activa } : {}),
      ...(comoTexto(req.query.usuarioId)
        ? { usuarioId: comoTexto(req.query.usuarioId) }
        : {}),
      ...(activoId !== undefined ? { activoId } : {}),
      ...(comoTexto(req.query.q) ? { q: comoTexto(req.query.q) } : {}),
    };

    const { asignaciones, meta } = await obtenerListado(parametros);

    const respuesta: RespuestaPaginada<AsignacionLista> = {
      success: true,
      message: 'Asignaciones obtenidas correctamente',
      errors: [],
      data: asignaciones,
      meta,
    };

    res.status(200).json(respuesta);
  }
);

export const editarAsignacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = leerIdAsignacion(req.params.id);

    if (
      typeof req.body !== 'object' ||
      req.body === null ||
      Array.isArray(req.body)
    ) {
      throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
    }

    const cuerpo = req.body as Record<string, unknown>;
    const desconocidos = Object.keys(cuerpo).filter(
      (campo) => !CAMPOS_EDITABLES_ASIGNACION.has(campo)
    );
    if (desconocidos.length > 0) {
      throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
        { campo: 'campos', valor: desconocidos },
      ]);
    }

    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const comoValor = (campo: string): string | null => {
      const texto = comoTexto(cuerpo[campo]);
      return texto === '' ? null : texto;
    };

    const datos: DatosEdicionAsignacion = {};

    if ('anioCompra' in cuerpo) {
      if (cuerpo.anioCompra === null || cuerpo.anioCompra === '') {
        datos.anioCompra = null;
      } else {
        const textoAnio =
          typeof cuerpo.anioCompra === 'number'
            ? String(cuerpo.anioCompra)
            : comoTexto(cuerpo.anioCompra);

        if (!/^\d+$/.test(textoAnio)) {
          throw new HttpError(400, 'El campo "anioCompra" debe ser un numero entero', [
            { campo: 'anioCompra', valor: textoAnio || String(cuerpo.anioCompra) },
          ]);
        }

        datos.anioCompra = Number(textoAnio);
      }
    }

    if ('numeroActivo' in cuerpo) datos.numeroActivo = comoValor('numeroActivo');
    if ('nombreEquipo' in cuerpo) datos.nombreEquipo = comoValor('nombreEquipo');
    if ('bitlocker' in cuerpo) datos.bitlocker = comoValor('bitlocker');
    if ('observacion' in cuerpo) datos.observacion = comoValor('observacion');

    const asignacion: AsignacionLista = await editarAsignacionService(id, datos);

    res.status(200).json({
      success: true,
      message: 'Asignacion actualizada correctamente',
      errors: [],
      data: asignacion,
    });
  }
);

export const eliminarAsignacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = await eliminarAsignacionService(leerIdAsignacion(req.params.id));

    res.status(200).json({
      success: true,
      message: 'Asignacion eliminada correctamente',
      errors: [],
      data: { id },
    });
  }
);
