import { Request, Response } from 'express';
import {
  EstadoProyecto,
  Prioridad,
  RolProyecto,
} from '../generated/prisma/client';
import { HttpError } from '../middlewares/error.middleware';
import { RespuestaPaginada } from '../models/comun.model';
import {
  DatosCreacionProyecto,
  DatosEdicionProyecto,
  DatosMiembroProyecto,
  ESTADOS_PROYECTO,
  ParametrosListadoProyectos,
  PRIORIDADES_PROYECTO,
  ROLES_PROYECTO,
} from '../models/proyecto.model';
import {
  actualizarMiembro,
  actualizarProyecto,
  agregarMiembro,
  crearProyecto,
  desactivarProyecto,
  eliminarMiembro,
  listarMiembros,
  listarProyectos,
  obtenerProyectoDetalle,
} from '../services/proyecto.service';
import { asyncHandler } from '../utils/asyncHandler';

const LIMITE_MAXIMO = 100;
const CAMPOS_MIEMBRO = new Set(['usuarioId', 'rol']);
const CAMPOS_PROYECTO = new Set([
  'nombre',
  'descripcion',
  'estado',
  'prioridad',
  'fechaInicio',
  'fechaFinPlanificada',
  'fechaFinReal',
  'presupuesto',
  'responsableId',
  'departamentoId',
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
    (campo) => !CAMPOS_PROYECTO.has(campo)
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

const leerDecimalNoNegativo = (
  valor: unknown,
  campo: string,
  opciones: { nullable?: boolean } = {}
): number | null => {
  if (valor === null && opciones.nullable) return null;
  if (valor === undefined && opciones.nullable) return null;
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser un numero mayor o igual a cero`,
      [{ campo, valor: valor ?? null }]
    );
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new HttpError(
      400,
      `El campo "${campo}" debe ser un numero mayor o igual a cero`,
      [{ campo, valor }]
    );
  }
  return Math.round(numero * 100) / 100;
};

const leerEnteroPositivo = (valor: unknown, campo: string): number => {
  if (
    typeof valor !== 'number' &&
    typeof valor !== 'string'
  ) {
    throw new HttpError(400, `El campo "${campo}" debe ser un entero positivo`, [
      { campo, valor: valor ?? null },
    ]);
  }
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (
    !Number.isSafeInteger(numero) ||
    numero < 1 ||
    numero > 2147483647
  ) {
    throw new HttpError(400, `El campo "${campo}" debe ser un entero positivo`, [
      { campo, valor },
    ]);
  }
  return numero;
};

const leerEnteroPositivoOpcional = (
  cuerpo: Record<string, unknown>,
  campo: string
): number | null => {
  if (!(campo in cuerpo)) return null;
  if (cuerpo[campo] === null) return null;
  return leerEnteroPositivo(cuerpo[campo], campo);
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
  return texto || undefined;
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

const leerEnumQuery = <T extends string>(
  valor: unknown,
  campo: string,
  permitidos: T[]
): T | undefined => {
  if (valor === undefined) return undefined;
  return leerEnum(valor, campo, permitidos);
};

export const listarProyectosController = asyncHandler(
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

    const parametros: ParametrosListadoProyectos = {
      page,
      limit,
      usuarioId: obtenerUsuarioId(req),
      ...(leerTextoQuery(req.query.q, 'q')
        ? { q: leerTextoQuery(req.query.q, 'q') }
        : {}),
      ...(leerEnumQuery(req.query.estado, 'estado', ESTADOS_PROYECTO)
        ? { estado: leerEnumQuery(req.query.estado, 'estado', ESTADOS_PROYECTO) }
        : {}),
      ...(leerEnumQuery(req.query.prioridad, 'prioridad', PRIORIDADES_PROYECTO)
        ? {
            prioridad: leerEnumQuery(
              req.query.prioridad,
              'prioridad',
              PRIORIDADES_PROYECTO
            ),
          }
        : {}),
      ...(leerTextoQuery(req.query.responsableId, 'responsableId')
        ? {
            responsableId: leerTextoQuery(
              req.query.responsableId,
              'responsableId'
            ),
          }
        : {}),
      ...(leerEnteroQueryOpcional(req.query.departamentoId, 'departamentoId')
        ? {
            departamentoId: leerEnteroQueryOpcional(
              req.query.departamentoId,
              'departamentoId'
            ),
          }
        : {}),
      ...(leerBooleanoQuery(req.query.activo, 'activo') !== undefined
        ? { activo: leerBooleanoQuery(req.query.activo, 'activo') }
        : {}),
    };

    const resultado = await listarProyectos(parametros);
    const respuesta: RespuestaPaginada<(typeof resultado.proyectos)[number]> = {
      success: true,
      message: 'Proyectos obtenidos correctamente',
      errors: [],
      data: resultado.proyectos,
      meta: resultado.meta,
    };
    res.status(200).json(respuesta);
  }
);

export const obtenerProyectoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Proyecto obtenido correctamente',
      errors: [],
      data: await obtenerProyectoDetalle(leerId(req.params.id)),
    });
  }
);

export const listarMiembrosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      message: 'Miembros del proyecto obtenidos correctamente',
      errors: [],
      data: await listarMiembros(leerId(req.params.id)),
    });
  }
);

const leerCuerpoMiembro = (valor: unknown): Record<string, unknown> => {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON', []);
  }
  const cuerpo = valor as Record<string, unknown>;
  const desconocidos = Object.keys(cuerpo).filter(
    (campo) => !CAMPOS_MIEMBRO.has(campo)
  );
  if (desconocidos.length > 0) {
    throw new HttpError(400, 'El cuerpo contiene campos no permitidos', [
      { campo: 'campos', valor: desconocidos },
    ]);
  }
  return cuerpo;
};

const leerUsuarioIdMiembro = (valor: unknown): string => {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new HttpError(400, 'El campo "usuarioId" es obligatorio', [
      { campo: 'usuarioId', valor: valor ?? null },
    ]);
  }
  const texto = valor.trim();
  if (texto.length > 191) {
    throw new HttpError(
      400,
      'El campo "usuarioId" no puede exceder 191 caracteres',
      [{ campo: 'usuarioId', valor: texto }]
    );
  }
  return texto;
};

export const agregarMiembroController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpoMiembro(req.body);
    const datos: DatosMiembroProyecto = {
      usuarioId: leerUsuarioIdMiembro(cuerpo.usuarioId),
      rol:
        'rol' in cuerpo
          ? leerEnum(cuerpo.rol, 'rol', ROLES_PROYECTO)
          : RolProyecto.DESARROLLADOR,
    };

    const miembro = await agregarMiembro(
      leerId(req.params.id),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(201).json({
      success: true,
      message: 'Miembro agregado al proyecto correctamente',
      errors: [],
      data: miembro,
    });
  }
);

export const actualizarMiembroController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpoMiembro(req.body);
    if (!('rol' in cuerpo)) {
      throw new HttpError(400, 'El campo "rol" es obligatorio', [
        { campo: 'rol', valor: null },
      ]);
    }
    const usuarioId = req.params.usuarioId;
    if (typeof usuarioId !== 'string' || usuarioId.trim() === '') {
      throw new HttpError(400, 'El parametro "usuarioId" es obligatorio', [
        { campo: 'usuarioId', valor: usuarioId ?? null },
      ]);
    }

    const miembro = await actualizarMiembro(
      leerId(req.params.id),
      usuarioId.trim(),
      leerEnum(cuerpo.rol, 'rol', ROLES_PROYECTO),
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Miembro del proyecto actualizado correctamente',
      errors: [],
      data: miembro,
    });
  }
);

export const eliminarMiembroController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const usuarioId = req.params.usuarioId;
    if (typeof usuarioId !== 'string' || usuarioId.trim() === '') {
      throw new HttpError(400, 'El parametro "usuarioId" es obligatorio', [
        { campo: 'usuarioId', valor: usuarioId ?? null },
      ]);
    }

    await eliminarMiembro(
      leerId(req.params.id),
      usuarioId.trim(),
      obtenerUsuarioId(req)
    );
    res.status(204).send();
  }
);

export const crearProyectoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    const nombre = leerTexto(cuerpo.nombre, 'nombre', {
      requerido: true,
      maximo: 200,
    }) as string;
    const fechaInicio = leerFecha(cuerpo.fechaInicio, 'fechaInicio', {
      requerido: true,
    }) as Date;
    const fechaFinPlanificada = leerFecha(
      cuerpo.fechaFinPlanificada,
      'fechaFinPlanificada',
      { requerido: true }
    ) as Date;
    const responsableId = leerTexto(cuerpo.responsableId, 'responsableId', {
      requerido: true,
      maximo: 191,
    }) as string;

    const datos: DatosCreacionProyecto = {
      nombre,
      descripcion: textoOpcional(cuerpo, 'descripcion', 10000),
      estado:
        'estado' in cuerpo
          ? leerEnum(cuerpo.estado, 'estado', ESTADOS_PROYECTO)
          : EstadoProyecto.PLANIFICADO,
      prioridad:
        'prioridad' in cuerpo
          ? leerEnum(cuerpo.prioridad, 'prioridad', PRIORIDADES_PROYECTO)
          : Prioridad.NORMAL,
      fechaInicio,
      fechaFinPlanificada,
      fechaFinReal: fechaOpcional(cuerpo, 'fechaFinReal'),
      presupuesto:
        'presupuesto' in cuerpo
          ? leerDecimalNoNegativo(cuerpo.presupuesto, 'presupuesto', {
              nullable: true,
            })
          : null,
      responsableId,
      departamentoId: leerEnteroPositivoOpcional(cuerpo, 'departamentoId'),
    };

    const proyecto = await crearProyecto(datos, obtenerUsuarioId(req));
    res.status(201).json({
      success: true,
      message: 'Proyecto creado correctamente',
      errors: [],
      data: proyecto,
    });
  }
);

export const actualizarProyectoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = leerCuerpo(req.body);
    if (Object.keys(cuerpo).length === 0) {
      throw new HttpError(400, 'Se requiere al menos un campo para actualizar', []);
    }

    const datos: DatosEdicionProyecto = {};
    if ('nombre' in cuerpo) {
      datos.nombre = leerTexto(cuerpo.nombre, 'nombre', {
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
      datos.estado = leerEnum(cuerpo.estado, 'estado', ESTADOS_PROYECTO);
    }
    if ('prioridad' in cuerpo) {
      datos.prioridad = leerEnum(
        cuerpo.prioridad,
        'prioridad',
        PRIORIDADES_PROYECTO
      );
    }
    if ('fechaInicio' in cuerpo) {
      datos.fechaInicio = leerFecha(cuerpo.fechaInicio, 'fechaInicio', {
        requerido: true,
      }) as Date;
    }
    if ('fechaFinPlanificada' in cuerpo) {
      datos.fechaFinPlanificada = leerFecha(
        cuerpo.fechaFinPlanificada,
        'fechaFinPlanificada',
        { requerido: true }
      ) as Date;
    }
    if ('fechaFinReal' in cuerpo) {
      datos.fechaFinReal = leerFecha(cuerpo.fechaFinReal, 'fechaFinReal', {
        nullable: true,
      });
    }
    if ('presupuesto' in cuerpo) {
      datos.presupuesto = leerDecimalNoNegativo(
        cuerpo.presupuesto,
        'presupuesto',
        { nullable: true }
      );
    }
    if ('responsableId' in cuerpo) {
      datos.responsableId = leerTexto(cuerpo.responsableId, 'responsableId', {
        requerido: true,
        maximo: 191,
      }) as string;
    }
    if ('departamentoId' in cuerpo) {
      datos.departamentoId = leerEnteroPositivoOpcional(
        cuerpo,
        'departamentoId'
      );
    }
    if ('activo' in cuerpo) {
      if (cuerpo.activo !== true) {
        throw new HttpError(
          400,
          'El campo "activo" solo acepta true para reactivar',
          [{ campo: 'activo' }]
        );
      }
      datos.activo = true;
    }

    const proyecto = await actualizarProyecto(
      leerId(req.params.id),
      datos,
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Proyecto actualizado correctamente',
      errors: [],
      data: proyecto,
    });
  }
);

export const eliminarProyectoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const proyecto = await desactivarProyecto(
      leerId(req.params.id),
      obtenerUsuarioId(req)
    );
    res.status(200).json({
      success: true,
      message: 'Proyecto desactivado correctamente',
      errors: [],
      data: proyecto,
    });
  }
);
