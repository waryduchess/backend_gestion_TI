import { Request, Response } from 'express';
import { EstadoHito } from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import {
  DatosCreacionHito,
  DatosEdicionHito,
  ESTADOS_HITO,
} from '../models/proyecto-hito.model';
import {
  actualizarHito,
  crearHito,
  desactivarHito,
  listarHitos,
  obtenerHito,
} from '../services/proyecto-hito.service';
import { asyncHandler } from '../utils/asyncHandler';

const CAMPOS_HITO = new Set([
  'titulo',
  'descripcion',
  'estado',
  'fechaPlanificada',
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

const leerCuerpo = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !CAMPOS_HITO.has(campo)
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

export const listarHitosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Hitos del proyecto obtenidos correctamente',
      errors: [],
      data: await listarHitos(leerId(req.params.id, 'id')),
    });
  }
);

export const obtenerHitoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Hito obtenido correctamente',
      errors: [],
      data: await obtenerHito(
        leerId(req.params.id, 'id'),
        leerId(req.params.hitoId, 'hitoId')
      ),
    });
  }
);

export const crearHitoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const datos: DatosCreacionHito = {
      titulo: leerTexto(cuerpo.titulo, 'titulo', {
        requerido: true,
        maximo: 200,
      }) as string,
      descripcion: textoOpcional(cuerpo, 'descripcion', 10000),
      estado:
        'estado' in cuerpo
          ? leerEnum(cuerpo.estado, 'estado', ESTADOS_HITO)
          : EstadoHito.PENDIENTE,
      fechaPlanificada: leerFecha(
        cuerpo.fechaPlanificada,
        'fechaPlanificada',
        { requerido: true }
      ) as Date,
      fechaCompletada:
        'fechaCompletada' in cuerpo
          ? leerFecha(cuerpo.fechaCompletada, 'fechaCompletada', {
              nullable: true,
            })
          : null,
      orden:
        'orden' in cuerpo ? leerEnteroNoNegativo(cuerpo.orden, 'orden') : 0,
    };

    const hito = await crearHito(
      leerId(req.params.id, 'id'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(201).json({
      success: true,
      message: 'Hito creado correctamente',
      errors: [],
      data: hito,
    });
  }
);

export const actualizarHitoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionHito = {};
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
      datos.estado = leerEnum(cuerpo.estado, 'estado', ESTADOS_HITO);
    }
    if ('fechaPlanificada' in cuerpo) {
      datos.fechaPlanificada = leerFecha(
        cuerpo.fechaPlanificada,
        'fechaPlanificada',
        { requerido: true }
      ) as Date;
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

    const hito = await actualizarHito(
      leerId(req.params.id, 'id'),
      leerId(req.params.hitoId, 'hitoId'),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Hito actualizado correctamente',
      errors: [],
      data: hito,
    });
  }
);

export const eliminarHitoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const hito = await desactivarHito(
      leerId(req.params.id, 'id'),
      leerId(req.params.hitoId, 'hitoId'),
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Hito desactivado correctamente',
      errors: [],
      data: hito,
    });
  }
);
