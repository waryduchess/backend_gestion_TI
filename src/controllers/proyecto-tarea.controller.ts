import { Request, Response } from 'express';
import { EstadoTarea, Prioridad } from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import { RespuestaPaginada } from '../models/comun.model';
import {
  DatosCreacionTarea,
  DatosEdicionTarea,
  ESTADOS_TAREA,
  ParametrosListadoTareas,
  PRIORIDADES_TAREA,
} from '../models/proyecto-tarea.model';
import {
  actualizarTarea,
  crearTarea,
  desactivarTarea,
  listarTareas,
  obtenerTarea,
} from '../services/proyecto-tarea.service';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_CREACION = new Set([
  'titulo',
  'descripcion',
  'estado',
  'prioridad',
  'parentId',
  'asignadoAId',
  'fechaInicio',
  'fechaVencimiento',
  'fechaCompletada',
  'orden',
]);
const CAMPOS_EDICION = new Set([
  'titulo',
  'descripcion',
  'estado',
  'prioridad',
  'asignadoAId',
  'fechaInicio',
  'fechaVencimiento',
  'fechaCompletada',
  'orden',
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

const leerCuerpo = (
  valor: unknown,
  permitidos: Set<string>
): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !permitidos.has(campo)
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

const textoOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string,
  maximo: number
): string | null => {
  if (!(campo in cuerpo)) return null;
  return leerTexto(cuerpo[campo], campo, { nullable: true, maximo });
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

const fechaOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string
): Date | null => {
  if (!(campo in cuerpo)) return null;
  return leerFecha(cuerpo[campo], campo, { nullable: true });
};

const leerEnteroNoNegativo = (valor: unknown, campo: string): number => {
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser un entero mayor o igual a cero`,
      [{ campo, valor: valor ?? null }]
    );
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser un entero mayor o igual a cero`,
      [{ campo, valor }]
    );
  }
  return numero;
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

const leerTextoQuery = (valor: unknown, campo: string): string | undefined => {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') {
    throw new HttpError(400, `El parametro "${campo}" debe ser texto`, []);
  }
  const texto = valor.trim();
  return texto || undefined;
};

const leerEnumQuery = <T extends string>(
  valor: unknown,
  campo: string,
  permitidos: T[]
): T | undefined => {
  if (valor === undefined) return undefined;
  return leerEnum(valor, campo, permitidos);
};

export const listarTareasController = asyncHandler(
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

    const parametros: ParametrosListadoTareas = {
      page,
      limit,
      ...(leerTextoQuery(req.query.q, 'q')
        ? { q: leerTextoQuery(req.query.q, 'q') }
        : {}),
      ...(leerEnumQuery(req.query.estado, 'estado', ESTADOS_TAREA)
        ? { estado: leerEnumQuery(req.query.estado, 'estado', ESTADOS_TAREA) }
        : {}),
      ...(leerEnumQuery(req.query.prioridad, 'prioridad', PRIORIDADES_TAREA)
        ? {
            prioridad: leerEnumQuery(
              req.query.prioridad,
              'prioridad',
              PRIORIDADES_TAREA
            ),
          }
        : {}),
      ...(leerTextoQuery(req.query.asignadoAId, 'asignadoAId')
        ? {
            asignadoAId: leerTextoQuery(
              req.query.asignadoAId,
              'asignadoAId'
            ),
          }
        : {}),
    };

    const resultado = await listarTareas(
      leerId(req.params.id, 'id'),
      parametros
    );
    const respuesta: RespuestaPaginada<(typeof resultado.tareas)[number]> = {
      success: true,
      message: 'Tareas obtenidas correctamente',
      errors: [],
      data: resultado.tareas,
      meta: resultado.meta,
    };
    res.status(200).json(respuesta);
  }
);

export const obtenerTareaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Tarea obtenida correctamente',
      errors: [],
      data: await obtenerTarea(
        leerId(req.params.id, 'id'),
        leerId(req.params.tareaId, 'tareaId')
      ),
    });
  }
);

export const crearTareaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body, CAMPOS_CREACION);
    const datos: DatosCreacionTarea = {
      titulo: leerTexto(cuerpo.titulo, 'titulo', {
        requerido: true,
        maximo: 200,
      }) as string,
      descripcion: textoOpcional(cuerpo, 'descripcion', 10000),
      estado:
        'estado' in cuerpo
          ? leerEnum(cuerpo.estado, 'estado', ESTADOS_TAREA)
          : EstadoTarea.PENDIENTE,
      prioridad:
        'prioridad' in cuerpo
          ? leerEnum(cuerpo.prioridad, 'prioridad', PRIORIDADES_TAREA)
          : Prioridad.NORMAL,
      parentId: leerEnteroPositivoOpcional(cuerpo, 'parentId'),
      asignadoAId: textoOpcional(cuerpo, 'asignadoAId', 191),
      fechaInicio: fechaOpcional(cuerpo, 'fechaInicio'),
      fechaVencimiento: fechaOpcional(cuerpo, 'fechaVencimiento'),
      fechaCompletada: fechaOpcional(cuerpo, 'fechaCompletada'),
      orden:
        'orden' in cuerpo ? leerEnteroNoNegativo(cuerpo.orden, 'orden') : 0,
    };

    const tarea = await crearTarea(
      leerId(req.params.id, 'id'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(201).json({
      success: true,
      message: 'Tarea creada correctamente',
      errors: [],
      data: tarea,
    });
  }
);

export const actualizarTareaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body, CAMPOS_EDICION);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionTarea = {};
    if ('titulo' in cuerpo) {
      datos.titulo = leerTexto(cuerpo.titulo, 'titulo', {
        requerido: true,
        maximo: 200,
      }) as string;
    }
    if ('descripcion' in cuerpo) {
      datos.descripcion = leerTexto(cuerpo.descripcion, 'descripcion', {
        nullable: true,
        maximo: 10000,
      });
    }
    if ('estado' in cuerpo) {
      datos.estado = leerEnum(cuerpo.estado, 'estado', ESTADOS_TAREA);
    }
    if ('prioridad' in cuerpo) {
      datos.prioridad = leerEnum(
        cuerpo.prioridad,
        'prioridad',
        PRIORIDADES_TAREA
      );
    }
    if ('asignadoAId' in cuerpo) {
      datos.asignadoAId = textoOpcional(cuerpo, 'asignadoAId', 191);
    }
    if ('fechaInicio' in cuerpo) {
      datos.fechaInicio = leerFecha(cuerpo.fechaInicio, 'fechaInicio', {
        nullable: true,
      });
    }
    if ('fechaVencimiento' in cuerpo) {
      datos.fechaVencimiento = leerFecha(
        cuerpo.fechaVencimiento,
        'fechaVencimiento',
        { nullable: true }
      );
    }
    if ('fechaCompletada' in cuerpo) {
      datos.fechaCompletada = leerFecha(
        cuerpo.fechaCompletada,
        'fechaCompletada',
        { nullable: true }
      );
    }
    if ('orden' in cuerpo) {
      datos.orden = leerEnteroNoNegativo(cuerpo.orden, 'orden');
    }

    const tarea = await actualizarTarea(
      leerId(req.params.id, 'id'),
      leerId(req.params.tareaId, 'tareaId'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Tarea actualizada correctamente',
      errors: [],
      data: tarea,
    });
  }
);

export const eliminarTareaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tarea = await desactivarTarea(
      leerId(req.params.id, 'id'),
      leerId(req.params.tareaId, 'tareaId'),
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Tarea desactivada correctamente',
      errors: [],
      data: tarea,
    });
  }
);
