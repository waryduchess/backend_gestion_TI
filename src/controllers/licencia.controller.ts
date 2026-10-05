import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionLicencia,
  DatosEdicionLicencia,
  ParametrosListadoLicencias,
} from '../models/licencia.model';
import {
  actualizarLicencia,
  crearLicencia,
  desactivarLicencia,
  listarLicencias,
  obtenerLicencia,
} from '../services/licencia.service';
import { RespuestaPaginada } from '../models/comun.model';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_LICENCIA = new Set([
  'software',
  'clave',
  'proveedor',
  'fechaCompra',
  'fechaVencimiento',
  'asignadaAId',
  'activa',
]);

const leerId = (valor: unknown): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, 'El parametro "id" debe ser un entero positivo', [
      { campo: 'id', valor: String(valor ?? '') },
    ]);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, 'El parametro "id" esta fuera de rango', [
      { campo: 'id', valor },
    ]);
  }
  return id;
};

const leerCuerpo = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !CAMPOS_LICENCIA.has(campo)
  );
  if (desconocidos.length > 0) {
    throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
      { campo: 'campos', valor: desconocidos },
    ]);
  }
  return cuerpo;
};

const leerTexto = (
  valor: unknown,
  campo: string,
  opciones: { requerido?: boolean; nullable?: boolean; maximo?: number } = {}
): string | null => {
  if (valor === null && opciones.nullable) return null;
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto && opciones.requerido) {
    throw new HttpError(400, `El campo "${campo}" es obligatorio`, [
      { campo, valor: texto },
    ]);
  }
  if (!texto && opciones.nullable) return null;
  if (!texto) {
    throw new HttpError(400, `El campo "${campo}" debe ser texto`, [
      { campo, valor: valor ?? null },
    ]);
  }
  if (opciones.maximo && texto.length > opciones.maximo) {
    throw new HttpError(
      400,
      `El campo "${campo}" no puede exceder ${opciones.maximo} caracteres`,
      [{ campo, valor: texto }]
    );
  }
  return texto;
};

const leerFecha = (
  valor: unknown,
  campo: string,
  opciones: { requerido?: boolean; nullable?: boolean } = {}
): Date | null => {
  if (valor === null && opciones.nullable) return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    if (!opciones.requerido && valor === undefined) return null;
    throw new HttpError(400, `El campo "${campo}" debe usar formato YYYY-MM-DD`, [
      { campo, valor: valor ?? null },
    ]);
  }
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== valor) {
    throw new HttpError(400, `El campo "${campo}" no contiene una fecha valida`, [
      { campo, valor },
    ]);
  }
  return fecha;
};

const leerFechaQuery = (
  valor: unknown,
  campo: string
): Date | undefined => {
  if (valor === undefined) return undefined;
  const fecha = leerFecha(valor, campo, { requerido: true });
  return fecha ?? undefined;
};

const leerBooleanoQuery = (
  valor: unknown,
  campo: string
): boolean | undefined => {
  if (valor === undefined) return undefined;
  if (valor === 'true') return true;
  if (valor === 'false') return false;
  throw new HttpError(400, `El parametro "${campo}" debe ser true o false`, [
    { campo, valor: String(valor) },
  ]);
};

const leerNumeroQuery = (
  valor: unknown,
  campo: string,
  predeterminado: number
): number => {
  if (valor === undefined) return predeterminado;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw new HttpError(400, `El parametro "${campo}" debe ser un entero`, [
      { campo, valor: String(valor) },
    ]);
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) {
    throw new HttpError(400, `El parametro "${campo}" esta fuera de rango`, [
      { campo, valor },
    ]);
  }
  return numero;
};

const textoOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string
): string | null => {
  if (!(campo in cuerpo)) return null;
  return leerTexto(cuerpo[campo], campo, { nullable: true, maximo: 191 });
};

const validarRangoFechas = (
  venceDesde: Date | undefined,
  venceHasta: Date | undefined
): void => {
  if (venceDesde && venceHasta && venceDesde > venceHasta) {
    throw new HttpError(
      400,
      '"venceDesde" no puede ser posterior a "venceHasta"',
      [
        {
          campo: 'venceDesde',
          valor: venceDesde.toISOString().slice(0, 10),
        },
      ]
    );
  }
};

export const listarLicenciasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = leerNumeroQuery(req.query.page, 'page', 1);
    const limit = leerNumeroQuery(req.query.limit, 'limit', 10);
    if (page < 1) {
      throw new HttpError(400, 'El parametro "page" debe ser mayor a cero', [
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

    const proveedor = req.query.proveedor;
    const q = req.query.q;
    if (proveedor !== undefined && typeof proveedor !== 'string') {
      throw new HttpError(400, 'El parametro "proveedor" debe ser texto', []);
    }
    if (q !== undefined && typeof q !== 'string') {
      throw new HttpError(400, 'El parametro "q" debe ser texto', []);
    }
    const venceDesde = leerFechaQuery(req.query.venceDesde, 'venceDesde');
    const venceHasta = leerFechaQuery(req.query.venceHasta, 'venceHasta');
    validarRangoFechas(venceDesde, venceHasta);

    const activa = leerBooleanoQuery(req.query.activa, 'activa');
    const parametros: ParametrosListadoLicencias = {
      page,
      limit,
      ...(activa !== undefined ? { activa } : {}),
      ...(typeof proveedor === 'string' && proveedor.trim()
        ? { proveedor: proveedor.trim() }
        : {}),
      ...(venceDesde ? { venceDesde } : {}),
      ...(venceHasta ? { venceHasta } : {}),
      ...(typeof q === 'string' && q.trim() ? { q: q.trim() } : {}),
    };

    const resultado = await listarLicencias(parametros);
    const respuesta: RespuestaPaginada<(typeof resultado.licencias)[number]> = {
      success: true,
      message: 'Licencias obtenidas correctamente',
      errors: [],
      data: resultado.licencias,
      meta: resultado.meta,
    };
    res.status(200).json(respuesta);
  }
);

export const obtenerLicenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Licencia obtenida correctamente',
      errors: [],
      data: await obtenerLicencia(leerId(req.params.id)),
    });
  }
);

export const crearLicenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const software = leerTexto(cuerpo.software, 'software', {
      requerido: true,
      maximo: 191,
    });
    const fechaVencimiento = leerFecha(
      cuerpo.fechaVencimiento,
      'fechaVencimiento',
      { requerido: true }
    );
    const clave = textoOpcional(cuerpo, 'clave');
    const proveedor = textoOpcional(cuerpo, 'proveedor');
    const fechaCompra =
      'fechaCompra' in cuerpo
        ? leerFecha(cuerpo.fechaCompra, 'fechaCompra', { nullable: true })
        : null;
    const asignadaAId = textoOpcional(cuerpo, 'asignadaAId');

    const datos: DatosCreacionLicencia = {
      software: software as string,
      clave,
      proveedor,
      fechaCompra,
      fechaVencimiento: fechaVencimiento as Date,
      asignadaAId,
    };
    const licencia = await crearLicencia(datos);
    res.status(201).json({
      success: true,
      message: 'Licencia creada correctamente',
      errors: [],
      data: licencia,
    });
  }
);

export const actualizarLicenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionLicencia = {};
    if ('software' in cuerpo) {
      datos.software = leerTexto(cuerpo.software, 'software', {
        requerido: true,
        maximo: 191,
      }) as string;
    }
    if ('clave' in cuerpo) datos.clave = textoOpcional(cuerpo, 'clave');
    if ('proveedor' in cuerpo) datos.proveedor = textoOpcional(cuerpo, 'proveedor');
    if ('fechaCompra' in cuerpo) {
      datos.fechaCompra = leerFecha(cuerpo.fechaCompra, 'fechaCompra', {
        nullable: true,
      });
    }
    if ('fechaVencimiento' in cuerpo) {
      datos.fechaVencimiento = leerFecha(
        cuerpo.fechaVencimiento,
        'fechaVencimiento',
        { requerido: true }
      ) as Date;
    }
    if ('asignadaAId' in cuerpo) {
      datos.asignadaAId = textoOpcional(cuerpo, 'asignadaAId');
    }
    if ('activa' in cuerpo) {
      if (typeof cuerpo.activa !== 'boolean') {
        throw new HttpError(400, 'El campo "activa" debe ser booleano', [
          { campo: 'activa', valor: cuerpo.activa },
        ]);
      }
      datos.activa = cuerpo.activa;
    }

    const licencia = await actualizarLicencia(
      leerId(req.params.id),
      datos
    );
    res.status(200).json({
      success: true,
      message: 'Licencia actualizada correctamente',
      errors: [],
      data: licencia,
    });
  }
);

export const eliminarLicenciaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const licencia = await desactivarLicencia(leerId(req.params.id));
    res.status(200).json({
      success: true,
      message: 'Licencia desactivada correctamente',
      errors: [],
      data: licencia,
    });
  }
);
