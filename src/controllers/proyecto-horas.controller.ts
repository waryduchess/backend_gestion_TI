import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { RespuestaPaginada } from '../models/comun.model';
import {
  DatosCreacionHoras,
  DatosEdicionHoras,
  ParametrosListadoHoras,
} from '../models/proyecto-horas.model';
import {
  actualizarRegistroHoras,
  crearRegistroHoras,
  desactivarRegistroHoras,
  listarHoras,
  obtenerRegistroHoras,
} from '../services/proyecto-horas.service';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_HORAS = new Set([
  'tareaId',
  'usuarioId',
  'fecha',
  'horas',
  'descripcion',
]);

const obtenerUsuarioId = (req: Request): string => {
  if (!req.usuario) {
    throw new HttpError(401, 'Autenticacion requerida');
  }
  return req.usuario.id;
};

const leerId = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(400, `El parametro "${campo}" debe ser un entero positivo`, [
      { campo, valor: String(valor ?? '') },
    ]);
  }
  const id = Number(valor);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, `El parametro "${campo}" esta fuera de rango`, [
      { campo, valor },
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
    (campo) => !CAMPOS_HORAS.has(campo)
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

const leerDecimalHoras = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(400, `El campo "${campo}" debe ser un numero`, [
      { campo, valor: valor ?? null },
    ]);
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero <= 0 || numero > 24) {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser mayor a cero y menor o igual a 24`,
      [{ campo, valor }]
    );
  }
  return Math.round(numero * 100) / 100;
};

const leerFecha = (
  valor: unknown,
  campo: string,
  opciones: { requerido?: boolean; nullable?: boolean; finDia?: boolean } = {}
): Date | null => {
  if (valor === null && opciones.nullable) return null;
  if (typeof valor !== 'string' || valor.trim() === '') {
    if (!opciones.requerido && valor === undefined) return null;
    if (opciones.nullable) return null;
    throw new HttpError(400, `El campo "${campo}" es obligatorio`, [
      { campo, valor: valor ?? null },
    ]);
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    throw new HttpError(400, `El campo "${campo}" debe ser una fecha valida`, [
      { campo, valor },
    ]);
  }
  if (opciones.finDia && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return new Date(fecha.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return fecha;
};

const leerEnteroPositivoOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string
): number | null => {
  if (!(campo in cuerpo)) return null;
  if (cuerpo[campo] === null) return null;
  const valor = cuerpo[campo];
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(400, `El campo "${campo}" debe ser un entero positivo`, [
      { campo, valor: valor ?? null },
    ]);
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > 2147483647) {
    throw new HttpError(400, `El campo "${campo}" debe ser un entero positivo`, [
      { campo, valor },
    ]);
  }
  return numero;
};

const leerEnteroQuery = (
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

const leerEnteroQueryOpcional = (
  valor: unknown,
  campo: string
): number | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) {
    throw new HttpError(
      400,
      `El parametro "${campo}" debe ser un entero positivo`,
      [{ campo, valor: String(valor) }]
    );
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero > 2147483647) {
    throw new HttpError(400, `El parametro "${campo}" esta fuera de rango`, [
      { campo, valor },
    ]);
  }
  return numero;
};

const leerTextoQuery = (valor: unknown, campo: string): string | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El parametro "${campo}" debe ser texto`, []);
  }
  const texto = valor.trim();
  return texto || undefined;
};

const leerFechaQuery = (valor: unknown, campo: string): Date | undefined => {
  if (valor === undefined) return undefined;
  const fecha = leerFecha(valor, campo, { requerido: true });
  return fecha ?? undefined;
};

export const listarHorasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = leerEnteroQuery(req.query.page, 'page', 1);
    const limit = leerEnteroQuery(req.query.limit, 'limit', 20);
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

    const parametros: ParametrosListadoHoras = {
      page,
      limit,
      ...(leerEnteroQueryOpcional(req.query.tareaId, 'tareaId')
        ? { tareaId: leerEnteroQueryOpcional(req.query.tareaId, 'tareaId') }
        : {}),
      ...(leerTextoQuery(req.query.usuarioId, 'usuarioId')
        ? { usuarioId: leerTextoQuery(req.query.usuarioId, 'usuarioId') }
        : {}),
      ...(leerFechaQuery(req.query.desde, 'desde')
        ? { desde: leerFechaQuery(req.query.desde, 'desde') }
        : {}),
      ...(leerFechaQuery(req.query.hasta, 'hasta')
        ? { hasta: leerFechaQuery(req.query.hasta, 'hasta') }
        : {}),
    };

    const resultado = await listarHoras(
      leerId(req.params.id, 'id'),
      parametros
    );
    const respuesta: RespuestaPaginada<(typeof resultado.registros)[number]> = {
      success: true,
      message: 'Registros de horas obtenidos correctamente',
      errors: [],
      data: resultado.registros,
      meta: resultado.meta,
    };
    res.status(200).json(respuesta);
  }
);

export const obtenerRegistroHorasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Registro de horas obtenido correctamente',
      errors: [],
      data: await obtenerRegistroHoras(
        leerId(req.params.id, 'id'),
        leerId(req.params.registroId, 'registroId')
      ),
    });
  }
);

export const crearRegistroHorasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const datos: DatosCreacionHoras = {
      tareaId: leerEnteroPositivoOpcional(cuerpo, 'tareaId'),
      usuarioId:
        'usuarioId' in cuerpo
          ? (leerTexto(cuerpo.usuarioId, 'usuarioId', {
              requerido: true,
              maximo: 191,
            }) as string)
          : obtenerUsuarioId(req),
      fecha: leerFecha(cuerpo.fecha, 'fecha', { requerido: true }) as Date,
      horas: leerDecimalHoras(cuerpo.horas, 'horas'),
      descripcion:
        'descripcion' in cuerpo
          ? leerTexto(cuerpo.descripcion, 'descripcion', {
              nullable: true,
              maximo: 10000,
            })
          : null,
    };

    const registro = await crearRegistroHoras(
      leerId(req.params.id, 'id'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(201).json({
      success: true,
      message: 'Registro de horas creado correctamente',
      errors: [],
      data: registro,
    });
  }
);

export const actualizarRegistroHorasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionHoras = {};
    if ('tareaId' in cuerpo) {
      datos.tareaId = leerEnteroPositivoOpcional(cuerpo, 'tareaId');
    }
    if ('usuarioId' in cuerpo) {
      datos.usuarioId = leerTexto(cuerpo.usuarioId, 'usuarioId', {
        requerido: true,
        maximo: 191,
      }) as string;
    }
    if ('fecha' in cuerpo) {
      datos.fecha = leerFecha(cuerpo.fecha, 'fecha', {
        requerido: true,
      }) as Date;
    }
    if ('horas' in cuerpo) {
      datos.horas = leerDecimalHoras(cuerpo.horas, 'horas');
    }
    if ('descripcion' in cuerpo) {
      datos.descripcion = leerTexto(cuerpo.descripcion, 'descripcion', {
        nullable: true,
        maximo: 10000,
      });
    }

    const registro = await actualizarRegistroHoras(
      leerId(req.params.id, 'id'),
      leerId(req.params.registroId, 'registroId'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Registro de horas actualizado correctamente',
      errors: [],
      data: registro,
    });
  }
);

export const eliminarRegistroHorasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const registro = await desactivarRegistroHoras(
      leerId(req.params.id, 'id'),
      leerId(req.params.registroId, 'registroId'),
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Registro de horas desactivado correctamente',
      errors: [],
      data: registro,
    });
  }
);
