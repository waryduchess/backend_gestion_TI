import { Request, Response } from 'express';
import {
  MantenimientoEstado,
  MantenimientoPrioridad,
  MantenimientoTipo,
} from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionMantenimiento,
  DatosEdicionMantenimiento,
  ESTADOS_MANTENIMIENTO,
  MantenimientoResumen,
  ParametrosListadoMantenimiento,
  PRIORIDADES_MANTENIMIENTO,
  TIPOS_MANTENIMIENTO,
} from '../models/mantenimiento.model';
import { RespuestaPaginada } from '../models/comun.model';
import {
  actualizarMantenimiento,
  crearMantenimiento,
  desactivarMantenimiento,
  listarMantenimientos,
  listarMantenimientosPorActivo,
  obtenerMantenimiento,
} from '../services/mantenimiento.service';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_MANTENIMIENTO = new Set([
  'activoId',
  'tipo',
  'estado',
  'prioridad',
  'tecnicoId',
  'fechaProgramada',
  'fechaRealizada',
  'costo',
  'descripcion',
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
    (campo) => !CAMPOS_MANTENIMIENTO.has(campo)
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

const leerEnteroPositivo = (valor: unknown, campo: string): number => {
  if (
    typeof valor !== 'number' ||
    !Number.isSafeInteger(valor) ||
    valor < 1 ||
    valor > 2147483647
  ) {
    throw new HttpError(400, `El campo "${campo}" debe ser un entero positivo`, [
      { campo, valor: valor ?? null },
    ]);
  }
  return valor;
};

const leerFecha = (
  valor: unknown,
  campo: string,
  opciones: { requerido?: boolean; nullable?: boolean } = {}
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
  return fecha;
};

const leerCosto = (
  valor: unknown,
  campo: string,
  opciones: { nullable?: boolean } = {}
): number | null => {
  if (valor === null && opciones.nullable) return null;
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(400, `El campo "${campo}" debe ser un numero`, [
      { campo, valor: valor ?? null },
    ]);
  }
  if (typeof valor === 'string' && valor.trim() === '') {
    throw new HttpError(400, `El campo "${campo}" debe ser un numero`, [
      { campo, valor },
    ]);
  }

  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser un numero mayor o igual a cero`,
      [{ campo, valor }]
    );
  }
  return numero;
};

const leerEnum = <T extends string>(
  valor: unknown,
  campo: string,
  permitidos: T[]
): T => {
  if (typeof valor !== 'string' || !permitidos.includes(valor as T)) {
    throw new HttpError(400, `El campo "${campo}" no tiene un valor valido`, [
      { campo, valor: valor ?? null, permitidos },
    ]);
  }
  return valor as T;
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
  return texto === '' ? undefined : texto;
};

const leerEnumQuery = <T extends string>(
  valor: unknown,
  campo: string,
  permitidos: T[]
): T | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || !permitidos.includes(valor as T)) {
    throw new HttpError(
      400,
      `El parametro "${campo}" no tiene un valor valido`,
      [{ campo, valor: String(valor), permitidos }]
    );
  }
  return valor as T;
};

export const listarMantenimientosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const page = leerEnteroQuery(req.query.page, 'page', 1);
    const limit = leerEnteroQuery(req.query.limit, 'limit', 10);

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

    const q = leerTextoQuery(req.query.q, 'q');
    const tipo = leerEnumQuery(
      req.query.tipo,
      'tipo',
      TIPOS_MANTENIMIENTO
    );
    const estado = leerEnumQuery(
      req.query.estado,
      'estado',
      ESTADOS_MANTENIMIENTO
    );
    const prioridad = leerEnumQuery(
      req.query.prioridad,
      'prioridad',
      PRIORIDADES_MANTENIMIENTO
    );
    const tecnicoId = leerTextoQuery(req.query.tecnicoId, 'tecnicoId');
    const activoId = leerEnteroQueryOpcional(req.query.activoId, 'activoId');

    const parametros: ParametrosListadoMantenimiento = {
      page,
      limit,
      ...(q ? { q } : {}),
      ...(tipo ? { tipo } : {}),
      ...(estado ? { estado } : {}),
      ...(prioridad ? { prioridad } : {}),
      ...(tecnicoId ? { tecnicoId } : {}),
      ...(activoId ? { activoId } : {}),
    };

    const resultado = await listarMantenimientos(parametros);
    const respuesta: RespuestaPaginada<MantenimientoResumen> = {
      success: true,
      message: 'Mantenimientos obtenidos correctamente',
      errors: [],
      data: resultado.mantenimientos,
      meta: resultado.meta,
    };
    res.status(200).json(respuesta);
  }
);

export const obtenerMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Mantenimiento obtenido correctamente',
      errors: [],
      data: await obtenerMantenimiento(leerId(req.params.id)),
    });
  }
);

export const listarMantenimientosPorActivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const activoId = leerId(req.params.activoId);
    res.status(200).json({
      success: true,
      message: 'Historial de mantenimientos obtenido correctamente',
      errors: [],
      data: await listarMantenimientosPorActivo(activoId),
    });
  }
);

export const crearMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const tipo = leerEnum(
      cuerpo.tipo,
      'tipo',
      TIPOS_MANTENIMIENTO
    ) as MantenimientoTipo;
    const estado =
      cuerpo.estado === undefined
        ? MantenimientoEstado.PROGRAMADO
        : (leerEnum(
            cuerpo.estado,
            'estado',
            ESTADOS_MANTENIMIENTO
          ) as MantenimientoEstado);
    const prioridad =
      cuerpo.prioridad === undefined
        ? MantenimientoPrioridad.MEDIA
        : (leerEnum(
            cuerpo.prioridad,
            'prioridad',
            PRIORIDADES_MANTENIMIENTO
          ) as MantenimientoPrioridad);

    const datos: DatosCreacionMantenimiento = {
      activoId: leerEnteroPositivo(cuerpo.activoId, 'activoId'),
      tipo,
      estado,
      prioridad,
      tecnicoId: leerTexto(cuerpo.tecnicoId, 'tecnicoId', {
        requerido: true,
        maximo: 191,
      }) as string,
      fechaProgramada: leerFecha(cuerpo.fechaProgramada, 'fechaProgramada', {
        requerido: true,
      }) as Date,
      fechaRealizada:
        'fechaRealizada' in cuerpo
          ? leerFecha(cuerpo.fechaRealizada, 'fechaRealizada', {
              nullable: true,
            })
          : null,
      costo:
        'costo' in cuerpo ? leerCosto(cuerpo.costo, 'costo', { nullable: true }) : null,
      descripcion:
        'descripcion' in cuerpo
          ? leerTexto(cuerpo.descripcion, 'descripcion', { nullable: true })
          : null,
    };

    const mantenimiento = await crearMantenimiento(
      datos,
      obtenerUsuarioId(req)
    );
    res.status(201).json({
      success: true,
      message: 'Mantenimiento creado correctamente',
      errors: [],
      data: mantenimiento,
    });
  }
);

export const actualizarMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionMantenimiento = {};
    if ('activoId' in cuerpo) {
      datos.activoId = leerEnteroPositivo(cuerpo.activoId, 'activoId');
    }
    if ('tipo' in cuerpo) {
      datos.tipo = leerEnum(
        cuerpo.tipo,
        'tipo',
        TIPOS_MANTENIMIENTO
      ) as MantenimientoTipo;
    }
    if ('estado' in cuerpo) {
      datos.estado = leerEnum(
        cuerpo.estado,
        'estado',
        ESTADOS_MANTENIMIENTO
      ) as MantenimientoEstado;
    }
    if ('prioridad' in cuerpo) {
      datos.prioridad = leerEnum(
        cuerpo.prioridad,
        'prioridad',
        PRIORIDADES_MANTENIMIENTO
      ) as MantenimientoPrioridad;
    }
    if ('tecnicoId' in cuerpo) {
      datos.tecnicoId = leerTexto(cuerpo.tecnicoId, 'tecnicoId', {
        requerido: true,
        maximo: 191,
      }) as string;
    }
    if ('fechaProgramada' in cuerpo) {
      datos.fechaProgramada = leerFecha(
        cuerpo.fechaProgramada,
        'fechaProgramada',
        { requerido: true }
      ) as Date;
    }
    if ('fechaRealizada' in cuerpo) {
      datos.fechaRealizada = leerFecha(
        cuerpo.fechaRealizada,
        'fechaRealizada',
        { nullable: true }
      );
    }
    if ('costo' in cuerpo) {
      datos.costo = leerCosto(cuerpo.costo, 'costo', { nullable: true });
    }
    if ('descripcion' in cuerpo) {
      datos.descripcion = leerTexto(cuerpo.descripcion, 'descripcion', {
        nullable: true,
      });
    }

    const mantenimiento = await actualizarMantenimiento(
      leerId(req.params.id),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Mantenimiento actualizado correctamente',
      errors: [],
      data: mantenimiento,
    });
  }
);

export const eliminarMantenimientoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    await desactivarMantenimiento(leerId(req.params.id), obtenerUsuarioId(req));
    res.status(204).send();
  }
);
