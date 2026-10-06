import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionSecreto,
  DatosEdicionSecreto,
  ParametrosListadoAuditoria,
  ParametrosListadoSecretos,
} from '../models/secreto.model';
import {
  actualizarSecreto,
  crearSecreto,
  desactivarSecreto,
  listarAuditoriaSecreto,
  listarSecretos,
  obtenerSecretoResumen,
  revelarPasswordSecreto,
} from '../services/secreto.service';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_SECRETO = new Set([
  'tipo',
  'proyecto',
  'nombre',
  'usuario',
  'password',
  'comentario',
  'activo',
]);
const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

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
    (campo) => !CAMPOS_SECRETO.has(campo)
  );
  if (desconocidos.length > 0) {
    throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
      { campo: 'campos', valor: desconocidos },
    ]);
  }
  return cuerpo;
};

const leerTextoOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string,
  maximo: number
): string | null => {
  const valor = cuerpo[campo];
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El campo "${campo}" debe ser texto`, [
      { campo },
    ]);
  }
  const texto = valor.trim();
  if (!texto) return null;
  if (texto.length > maximo) {
    throw new HttpError(
      400,
      `El campo "${campo}" no puede exceder ${maximo} caracteres`,
      [{ campo, maximo }]
    );
  }
  return texto;
};

const leerPassword = (valor: unknown): string => {
  if (
    typeof valor !== 'string' ||
    valor.length === 0 ||
    Buffer.byteLength(valor, 'utf8') > 65000
  ) {
    throw new HttpError(
      400,
      'El campo "password" debe ser un texto no vacio de hasta 65000 bytes',
      [{ campo: 'password' }]
    );
  }
  return valor;
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

const leerTextoQuery = (valor: unknown, campo: string): string | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El parametro "${campo}" debe ser texto`, []);
  }
  const texto = valor.trim();
  return texto || undefined;
};

const leerPaginacion = (
  req: Request
): { page: number; limit: number } => {
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
  return { page, limit };
};

export const listarSecretosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const paginacion = leerPaginacion(req);
    const activo = leerBooleanoQuery(req.query.activo, 'activo');
    const tipo = leerTextoQuery(req.query.tipo, 'tipo');
    const proyecto = leerTextoQuery(req.query.proyecto, 'proyecto');
    const q = leerTextoQuery(req.query.q, 'q');
    const parametros: ParametrosListadoSecretos = {
      ...paginacion,
      ...(activo !== undefined ? { activo } : {}),
      ...(tipo ? { tipo } : {}),
      ...(proyecto ? { proyecto } : {}),
      ...(q ? { q } : {}),
    };
    const resultado = await listarSecretos(parametros);
    res.status(200).json({
      success: true,
      message: 'Secretos obtenidos correctamente',
      errors: [],
      data: resultado.secretos,
      meta: resultado.meta,
    });
  }
);

export const obtenerSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Secreto obtenido correctamente',
      errors: [],
      data: await obtenerSecretoResumen(leerId(req.params.id)),
    });
  }
);

export const obtenerPasswordSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.status(200).json({
      success: true,
      message: 'Password revelado correctamente',
      errors: [],
      data: await revelarPasswordSecreto(
        obtenerUsuarioId(req),
        leerId(req.params.id)
      ),
    });
  }
);

export const crearSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const datos: DatosCreacionSecreto = {
      tipo: leerTextoOpcional(cuerpo, 'tipo', 191),
      proyecto: leerTextoOpcional(cuerpo, 'proyecto', 191),
      nombre: leerTextoOpcional(cuerpo, 'nombre', 191),
      usuario: leerTextoOpcional(cuerpo, 'usuario', 191),
      password: leerPassword(cuerpo.password),
      comentario: leerTextoOpcional(cuerpo, 'comentario', 10000),
    };
    const secreto = await crearSecreto(obtenerUsuarioId(req), datos);
    res.status(201).json({
      success: true,
      message: 'Secreto creado correctamente',
      errors: [],
      data: secreto,
    });
  }
);

export const actualizarSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionSecreto = {};
    if ('tipo' in cuerpo) datos.tipo = leerTextoOpcional(cuerpo, 'tipo', 191);
    if ('proyecto' in cuerpo) {
      datos.proyecto = leerTextoOpcional(cuerpo, 'proyecto', 191);
    }
    if ('nombre' in cuerpo) {
      datos.nombre = leerTextoOpcional(cuerpo, 'nombre', 191);
    }
    if ('usuario' in cuerpo) {
      datos.usuario = leerTextoOpcional(cuerpo, 'usuario', 191);
    }
    if ('comentario' in cuerpo) {
      datos.comentario = leerTextoOpcional(cuerpo, 'comentario', 10000);
    }
    if ('password' in cuerpo) datos.password = leerPassword(cuerpo.password);
    if ('activo' in cuerpo) {
      if (cuerpo.activo !== true) {
        throw new HttpError(400, 'El campo "activo" solo acepta true para reactivar', [
          { campo: 'activo' },
        ]);
      }
      datos.activo = true;
    }

    const secreto = await actualizarSecreto(
      obtenerUsuarioId(req),
      leerId(req.params.id),
      datos
    );
    res.status(200).json({
      success: true,
      message: 'Secreto actualizado correctamente',
      errors: [],
      data: secreto,
    });
  }
);

export const desactivarSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const secreto = await desactivarSecreto(
      obtenerUsuarioId(req),
      leerId(req.params.id)
    );
    res.status(200).json({
      success: true,
      message: 'Secreto desactivado correctamente',
      errors: [],
      data: secreto,
    });
  }
);

export const listarAuditoriaSecretoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const paginacion = leerPaginacion(req);
    const parametros: ParametrosListadoAuditoria = {
      secretoId: leerId(req.params.id),
      ...paginacion,
    };
    const resultado = await listarAuditoriaSecreto(parametros);
    res.status(200).json({
      success: true,
      message: 'Auditoria del secreto obtenida correctamente',
      errors: [],
      data: resultado.auditoria,
      meta: resultado.meta,
    });
  }
);
