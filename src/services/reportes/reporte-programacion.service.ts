import cron from 'node-cron';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/error.middleware';
import { UsuarioAuth } from '../../models/auth.model';
import {
  DatosCreacionProgramacion,
  DatosEdicionProgramacion,
  FormatoReporte,
  ParametrosListadoProgramaciones,
  ReporteProgramadoResumen,
  ResultadoListadoProgramaciones,
} from '../../models/reporte.model';
import { registrarAuditoria } from '../auditoria.service';
import { recargarProgramacionesReportes } from '../../jobs/reportes.job';
import {
  resolverFormato,
  validarPermisosReporte,
} from './reporte.service';
import { obtenerDefinicionReporte } from './index';

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const mapearProgramacion = (fila: {
  id: number;
  codigo: string;
  formato: string;
  parametros: Prisma.JsonValue | null;
  cron: string;
  destinatarios: Prisma.JsonValue;
  activo: boolean;
  usuarioId: string;
  ultimaEjecucion: Date | null;
  ultimoEstado: string | null;
  ultimoError: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ReporteProgramadoResumen => ({
  id: fila.id,
  codigo: fila.codigo,
  formato: fila.formato as FormatoReporte,
  parametros:
    fila.parametros &&
    typeof fila.parametros === 'object' &&
    !Array.isArray(fila.parametros)
      ? (fila.parametros as Record<string, unknown>)
      : null,
  cron: fila.cron,
  destinatarios: Array.isArray(fila.destinatarios)
    ? fila.destinatarios.filter(
        (valor): valor is string => typeof valor === 'string'
      )
    : [],
  activo: fila.activo,
  usuarioId: fila.usuarioId,
  ultimaEjecucion: fila.ultimaEjecucion,
  ultimoEstado: fila.ultimoEstado,
  ultimoError: fila.ultimoError,
  createdAt: fila.createdAt,
  updatedAt: fila.updatedAt,
});

const validarCron = (expresion: string): void => {
  if (expresion.trim() === '' || !cron.validate(expresion)) {
    throw new HttpError(
      400,
      'El campo "cron" debe contener una expresión cron válida',
      [{ campo: 'cron', valor: expresion }]
    );
  }
};

const validarDestinatarios = (destinatarios: string[]): string[] => {
  const limpios = [...new Set(
    destinatarios.map((correo) => correo.trim()).filter(Boolean)
  )];

  if (limpios.length === 0) {
    throw new HttpError(
      400,
      'Debes indicar al menos un destinatario',
      [{ campo: 'destinatarios', valor: [] }]
    );
  }
  if (limpios.length > 20) {
    throw new HttpError(
      400,
      'No se permiten más de 20 destinatarios',
      [{ campo: 'destinatarios', valor: limpios.length }]
    );
  }

  const invalidos = limpios.filter((correo) => !CORREO_VALIDO.test(correo));
  if (invalidos.length > 0) {
    throw new HttpError(
      400,
      'Uno o más destinatarios no tienen un correo válido',
      [{ campo: 'destinatarios', valor: invalidos }]
    );
  }
  return limpios;
};

const validarDefinicion = async (
  codigo: string,
  formato: string,
  parametros: Record<string, unknown>,
  usuarioId: string
): Promise<FormatoReporte> => {
  const definicion = obtenerDefinicionReporte(codigo);
  if (!definicion) {
    throw new HttpError(404, 'Reporte no encontrado', [
      { campo: 'codigo', valor: codigo },
    ]);
  }
  const formatoValido = resolverFormato(definicion, formato);
  await validarPermisosReporte(definicion, usuarioId);
  definicion.validarFiltros(parametros);
  return formatoValido;
};

const refrescarScheduler = async (): Promise<void> => {
  try {
    await recargarProgramacionesReportes();
  } catch (error) {
    console.error('[REPORTES] No se pudo recargar el scheduler', error);
  }
};

export const listarProgramaciones = async (
  usuarioId: string,
  parametros: ParametrosListadoProgramaciones
): Promise<ResultadoListadoProgramaciones> => {
  const where = { usuarioId };
  const [filas, total] = await Promise.all([
    prisma.reporteProgramado.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.reporteProgramado.count({ where }),
  ]);

  return {
    programaciones: filas.map(mapearProgramacion),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parametros.limit)),
    },
  };
};

export const obtenerProgramacion = async (
  id: number,
  usuarioId: string
): Promise<ReporteProgramadoResumen> => {
  const fila = await prisma.reporteProgramado.findFirst({
    where: { id, usuarioId },
  });
  if (!fila) {
    throw new HttpError(404, 'Programación de reporte no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  return mapearProgramacion(fila);
};

export const crearProgramacion = async (
  datos: DatosCreacionProgramacion,
  usuario: UsuarioAuth
): Promise<ReporteProgramadoResumen> => {
  const formato = await validarDefinicion(
    datos.codigo,
    datos.formato,
    datos.parametros,
    usuario.id
  );
  validarCron(datos.cron);
  const destinatarios = validarDestinatarios(datos.destinatarios);

  const fila = await prisma.$transaction(async (tx) => {
    const creada = await tx.reporteProgramado.create({
      data: {
        codigo: datos.codigo,
        formato,
        parametros: datos.parametros as Prisma.InputJsonValue,
        cron: datos.cron.trim(),
        destinatarios: destinatarios as Prisma.InputJsonValue,
        usuarioId: usuario.id,
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'REPORTES',
      accion: 'PROGRAMAR',
      entidadId: creada.id,
      usuarioId: usuario.id,
      detalle: {
        codigo: datos.codigo,
        formato,
        campos: Object.keys(datos.parametros),
      },
    });

    return creada;
  });

  await refrescarScheduler();
  return mapearProgramacion(fila);
};

export const actualizarProgramacion = async (
  id: number,
  usuarioId: string,
  datos: DatosEdicionProgramacion
): Promise<ReporteProgramadoResumen> => {
  const existente = await prisma.reporteProgramado.findFirst({
    where: { id, usuarioId },
  });
  if (!existente) {
    throw new HttpError(404, 'Programación de reporte no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }

  const formato =
    datos.formato !== undefined
      ? await validarDefinicion(
          existente.codigo,
          datos.formato,
          datos.parametros ??
            (existente.parametros as Record<string, unknown> | null) ??
            {},
          usuarioId
        )
      : undefined;
  if (datos.cron !== undefined) validarCron(datos.cron);
  const destinatarios =
    datos.destinatarios !== undefined
      ? validarDestinatarios(datos.destinatarios)
      : undefined;

  const fila = await prisma.$transaction(async (tx) => {
    const actualizada = await tx.reporteProgramado.update({
      where: { id },
      data: {
        ...(formato !== undefined ? { formato } : {}),
        ...(datos.parametros !== undefined
          ? { parametros: datos.parametros as Prisma.InputJsonValue }
          : {}),
        ...(datos.cron !== undefined ? { cron: datos.cron.trim() } : {}),
        ...(destinatarios !== undefined
          ? { destinatarios: destinatarios as Prisma.InputJsonValue }
          : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      },
    });

    await registrarAuditoria(tx, {
      modulo: 'REPORTES',
      accion: 'ACTUALIZAR',
      entidadId: id,
      usuarioId,
      detalle: { campos: Object.keys(datos) },
    });

    return actualizada;
  });

  await refrescarScheduler();
  return mapearProgramacion(fila);
};

export const desactivarProgramacion = async (
  id: number,
  usuarioId: string
): Promise<ReporteProgramadoResumen> => {
  const existente = await prisma.reporteProgramado.findFirst({
    where: { id, usuarioId },
  });
  if (!existente) {
    throw new HttpError(404, 'Programación de reporte no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  if (!existente.activo) return mapearProgramacion(existente);

  const fila = await prisma.$transaction(async (tx) => {
    const actualizada = await tx.reporteProgramado.update({
      where: { id },
      data: { activo: false },
    });
    await registrarAuditoria(tx, {
      modulo: 'REPORTES',
      accion: 'DESACTIVAR',
      entidadId: id,
      usuarioId,
      detalle: { campos: ['activo'] },
    });
    return actualizada;
  });

  await refrescarScheduler();
  return mapearProgramacion(fila);
};
