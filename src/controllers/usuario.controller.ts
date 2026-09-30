import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoEntero, comoFecha, comoTexto, validarCampoOpcion } from '../utils/validacion';
import {
  cambiarPassword,
  crear,
  actualizar,
  asignarRol,
  eliminar,
  listar,
  obtenerPorId,
} from '../services/usuario.service';
import {
  DatosCreacionUsuario,
  DatosEdicionUsuario,
  ParametrosListadoUsuarios,
  UsuarioDetalle,
} from '../models/usuario.model';
import { RespuestaPaginada } from '../models/comun.model';

const LIMITE_MAXIMO = 100;

const comoNumeroBody = (valor: unknown, campo: string): number | null => {
  if (typeof valor === 'number') {
    if (!Number.isInteger(valor) || valor < 0) {
      throw new HttpError(400, `El campo "${campo}" debe ser un numero entero`, [
        { campo, valor: String(valor) },
      ]);
    }
    return valor;
  }

  const texto = comoTexto(valor);
  if (texto === '') {
    return null;
  }
  return comoEntero(texto, campo, 1);
};

export const listarUsuarios = asyncHandler(
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

    const activoTexto = validarCampoOpcion(req.query.activo, 'activo', ['true', 'false']);
    const activo = activoTexto === undefined ? undefined : activoTexto === 'true';

    const parametroNumerico = (nombre: string): number | undefined => {
      const texto = comoTexto(req.query[nombre]);
      return texto === '' ? undefined : comoEntero(texto, nombre, 1);
    };

    const parametros: ParametrosListadoUsuarios = {
      page,
      limit,
      ...(comoTexto(req.query.q) ? { q: comoTexto(req.query.q) } : {}),
      ...(parametroNumerico('departamentoId') !== undefined
        ? { departamentoId: parametroNumerico('departamentoId') }
        : {}),
      ...(parametroNumerico('ubicacionId') !== undefined
        ? { ubicacionId: parametroNumerico('ubicacionId') }
        : {}),
      ...(parametroNumerico('puestoId') !== undefined
        ? { puestoId: parametroNumerico('puestoId') }
        : {}),
      ...(parametroNumerico('tipoUsuarioId') !== undefined
        ? { tipoUsuarioId: parametroNumerico('tipoUsuarioId') }
        : {}),
      ...(activo !== undefined ? { activo } : {}),
    };

    const { usuarios, meta } = await listar(parametros);

    const respuesta: RespuestaPaginada<UsuarioDetalle> = {
      success: true,
      message: 'Usuarios obtenidos correctamente',
      errors: [],
      data: usuarios,
      meta,
    };

    res.status(200).json(respuesta);
  }
);

export const obtenerUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (textoId === '') {
      throw new HttpError(400, 'El parametro "id" es obligatorio', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const usuario = await obtenerPorId(textoId);

    res.status(200).json({
      success: true,
      message: 'Usuario obtenido correctamente',
      errors: [],
      data: usuario,
    });
  }
);

export const crearUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;

    const id = comoTexto(cuerpo.id);
    const nombre = comoTexto(cuerpo.nombre);

    if (id === '' || nombre === '') {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        ...(id === ''
          ? [{ campo: 'id', valor: '', mensaje: 'El id es obligatorio' }]
          : []),
        ...(nombre === ''
          ? [{ campo: 'nombre', valor: '', mensaje: 'El nombre es obligatorio' }]
          : []),
      ]);
    }

    const texto = (campo: string): string | null => {
      const valor = comoTexto(cuerpo[campo]);
      return valor === '' ? null : valor;
    };

    const numero = (campo: string): number | null =>
      comoNumeroBody(cuerpo[campo], campo);

    let password: string | null = null;
    if ('password' in cuerpo) {
      const valor = comoTexto(cuerpo.password);
      if (valor === '') {
        throw new HttpError(400, 'El campo "password" no puede estar vacio', [
          { campo: 'password', valor: '' },
        ]);
      }
      password = valor;
    }

    const datos: DatosCreacionUsuario = {
      id,
      nombre,
      email: texto('email'),
      password,
      departamentoId: 'departamentoId' in cuerpo ? numero('departamentoId') : null,
      ubicacionId: 'ubicacionId' in cuerpo ? numero('ubicacionId') : null,
      puestoId: 'puestoId' in cuerpo ? numero('puestoId') : null,
      tipoUsuarioId: 'tipoUsuarioId' in cuerpo ? numero('tipoUsuarioId') : null,
      fechaInicio: comoFecha(cuerpo.fechaInicio, 'fechaInicio'),
      fechaFin: comoFecha(cuerpo.fechaFin, 'fechaFin'),
    };

    const usuario = await crear(datos);

    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente',
      errors: [],
      data: usuario,
    });
  }
);

export const actualizarUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (textoId === '') {
      throw new HttpError(400, 'El parametro "id" es obligatorio', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;

    if ('id' in cuerpo) {
      throw new HttpError(400, 'El campo "id" no se puede editar', [
        { campo: 'id', valor: comoTexto(cuerpo.id) || null },
      ]);
    }

    if ('password' in cuerpo) {
      throw new HttpError(
        400,
        'El campo "password" no se puede editar aqui; use PATCH /api/usuarios/:id/password',
        [{ campo: 'password', valor: null }]
      );
    }

    const presente = (campo: string): boolean => campo in cuerpo;
    const comoValor = (campo: string): string | null => {
      const valor = comoTexto(cuerpo[campo]);
      return valor === '' ? null : valor;
    };
    const comoNumero = (campo: string): number | null =>
      comoNumeroBody(cuerpo[campo], campo);

    const datos: DatosEdicionUsuario = {};
    let camposRecibidos = 0;

    if (presente('nombre')) {
      const nombre = comoTexto(cuerpo.nombre);
      if (nombre === '') {
        throw new HttpError(400, 'Faltan campos obligatorios', [
          { campo: 'nombre', valor: '', mensaje: 'El nombre es obligatorio' },
        ]);
      }
      datos.nombre = nombre;
      camposRecibidos += 1;
    }

    if (presente('email')) {
      datos.email = comoValor('email');
      camposRecibidos += 1;
    }

    if (presente('activo')) {
      if (typeof cuerpo.activo !== 'boolean') {
        throw new HttpError(400, 'El campo "activo" debe ser true o false', [
          { campo: 'activo', valor: comoTexto(cuerpo.activo) || null },
        ]);
      }
      datos.activo = cuerpo.activo;
      camposRecibidos += 1;
    }

    if (presente('departamentoId')) {
      datos.departamentoId = comoNumero('departamentoId');
      camposRecibidos += 1;
    }

    if (presente('ubicacionId')) {
      datos.ubicacionId = comoNumero('ubicacionId');
      camposRecibidos += 1;
    }

    if (presente('puestoId')) {
      datos.puestoId = comoNumero('puestoId');
      camposRecibidos += 1;
    }

    if (presente('tipoUsuarioId')) {
      datos.tipoUsuarioId = comoNumero('tipoUsuarioId');
      camposRecibidos += 1;
    }

    if (presente('fechaInicio')) {
      datos.fechaInicio = comoFecha(cuerpo.fechaInicio, 'fechaInicio');
      camposRecibidos += 1;
    }

    if (presente('fechaFin')) {
      datos.fechaFin = comoFecha(cuerpo.fechaFin, 'fechaFin');
      camposRecibidos += 1;
    }

    if (camposRecibidos === 0) {
      throw new HttpError(400, 'No se recibio ningun campo para actualizar', []);
    }

    const usuario = await actualizar(textoId, datos);

    res.status(200).json({
      success: true,
      message: 'Usuario actualizado correctamente',
      errors: [],
      data: usuario,
    });
  }
);

export const cambiarPasswordUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (textoId === '') {
      throw new HttpError(400, 'El parametro "id" es obligatorio', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const password = comoTexto(cuerpo.password);

    if (password === '') {
      throw new HttpError(400, 'Faltan campos obligatorios', [
        { campo: 'password', valor: '', mensaje: 'El password es obligatorio' },
      ]);
    }

    const usuario = await cambiarPassword(textoId, password);

    res.status(200).json({
      success: true,
      message: 'Password actualizado correctamente',
      errors: [],
      data: usuario,
    });
  }
);

export const asignarRolUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);
    if (textoId === '') {
      throw new HttpError(400, 'El parametro "id" es obligatorio', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    if (!('rolId' in cuerpo)) {
      throw new HttpError(400, 'El campo "rolId" es obligatorio; use null para quitar el rol', [
        { campo: 'rolId', valor: null },
      ]);
    }

    const usuario = await asignarRol(
      textoId,
      cuerpo.rolId === null ? null : comoNumeroBody(cuerpo.rolId, 'rolId')
    );
    res.status(200).json({
      success: true,
      message: 'Rol asignado correctamente',
      errors: [],
      data: usuario,
    });
  }
);

export const eliminarUsuario = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (textoId === '') {
      throw new HttpError(400, 'El parametro "id" es obligatorio', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const usuario = await eliminar(textoId);

    res.status(200).json({
      success: true,
      message: 'Usuario dado de baja correctamente',
      errors: [],
      data: usuario,
    });
  }
);
