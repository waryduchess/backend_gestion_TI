import {
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Prisma } from '../../generated/prisma/client';
import { prisma } from '../../config/prisma';
import {
  asegurarBucket,
  BUCKET_REPORTES,
  s3,
  s3Presign,
} from '../../config/s3';
import { HttpError } from '../../middlewares/error.middleware';
import { UsuarioAuth } from '../../models/auth.model';
import {
  DescargaReporteGenerado,
  FormatoReporte,
  ParametrosListadoGeneraciones,
  ReporteDescarga,
  ReporteGeneracionResumen,
  ReporteMetadata,
  ResultadoListadoGeneraciones,
} from '../../models/reporte.model';
import { usuarioTienePermiso } from '../../utils/permisos-usuario';
import { registrarAuditoria } from '../auditoria.service';
import {
  listarDefinicionesReportes,
  mapearMetadataReporte,
  obtenerDefinicionReporte,
} from './index';
import { nombreArchivoSeguro } from './renderers/comun';
import { renderizarCsv } from './renderers/csv.renderer';
import { renderizarPdf } from './renderers/pdf.renderer';
import { renderizarXlsx } from './renderers/xlsx.renderer';

const CONTENT_TYPES: Record<FormatoReporte, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
};

const FORMATOS: FormatoReporte[] = ['xlsx', 'pdf', 'csv'];
const TTL_CONFIGURADO = Number(process.env.S3_PRESIGN_TTL_SECONDS);
const TTL_DESCARGA =
  Number.isSafeInteger(TTL_CONFIGURADO) && TTL_CONFIGURADO > 0
    ? Math.min(Math.max(TTL_CONFIGURADO, 60), 3600)
    : 300;

export const listarCatalogoReportes = (): ReporteMetadata[] =>
  listarDefinicionesReportes().map(mapearMetadataReporte);

export const obtenerMetadataReporte = (codigo: string): ReporteMetadata => {
  const definicion = obtenerDefinicionReporte(codigo);
  if (!definicion) {
    throw new HttpError(404, 'Reporte no encontrado', [
      { campo: 'codigo', valor: codigo },
    ]);
  }
  return mapearMetadataReporte(definicion);
};

export const resolverFormato = (
  definicion: NonNullable<ReturnType<typeof obtenerDefinicionReporte>>,
  formatoQuery: unknown
): FormatoReporte => {
  const formatoTexto =
    typeof formatoQuery === 'string' && formatoQuery.trim() !== ''
      ? formatoQuery.trim()
      : 'xlsx';

  if (!FORMATOS.includes(formatoTexto as FormatoReporte)) {
    throw new HttpError(400, 'El parámetro "formato" no es válido', [
      {
        campo: 'formato',
        valor: formatoTexto,
        permitidos: definicion.formatos,
      },
    ]);
  }
  const formato = formatoTexto as FormatoReporte;

  if (!definicion.formatos.includes(formato)) {
    throw new HttpError(400, 'El reporte no está disponible en ese formato', [
      {
        campo: 'formato',
        valor: formato,
        permitidos: definicion.formatos,
      },
    ]);
  }
  return formato;
};

export const validarPermisosReporte = async (
  definicion: NonNullable<ReturnType<typeof obtenerDefinicionReporte>>,
  usuarioId: string
): Promise<void> => {
  for (const permiso of definicion.permisos) {
    if (!(await usuarioTienePermiso(usuarioId, permiso))) {
      throw new HttpError(403, 'No tienes permisos para generar este reporte', [
        {
          campo: 'permisos',
          requeridos: definicion.permisos,
          faltantes: [permiso],
        },
      ]);
    }
  }
};

const construirDescarga = async (
  definicion: NonNullable<ReturnType<typeof obtenerDefinicionReporte>>,
  formato: FormatoReporte,
  filtros: Record<string, unknown>,
  usuario: UsuarioAuth
): Promise<ReporteDescarga> => {
  const documento = await definicion.cargar(filtros, usuario);
  documento.generadoEn = new Date();
  documento.generadoPor = usuario.nombre;

  let buffer: Buffer;
  if (formato === 'xlsx') {
    buffer = await renderizarXlsx(documento);
  } else if (formato === 'pdf') {
    buffer = await renderizarPdf(documento);
  } else {
    buffer = renderizarCsv(documento);
  }

  const fecha = documento.generadoEn
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19);
  return {
    buffer,
    filename: nombreArchivoSeguro(`${definicion.codigo}-${fecha}`, formato),
    contentType: CONTENT_TYPES[formato],
  };
};

export const generarReporte = async (
  codigo: string,
  formatoQuery: unknown,
  query: Record<string, unknown>,
  usuario: UsuarioAuth
): Promise<ReporteDescarga> => {
  const definicion = obtenerDefinicionReporte(codigo);
  if (!definicion) {
    throw new HttpError(404, 'Reporte no encontrado', [
      { campo: 'codigo', valor: codigo },
    ]);
  }

  const formato = resolverFormato(definicion, formatoQuery);
  await validarPermisosReporte(definicion, usuario.id);
  const filtros = definicion.validarFiltros(query);
  const descarga = await construirDescarga(
    definicion,
    formato,
    filtros,
    usuario
  );

  await registrarAuditoria(prisma, {
    modulo: 'REPORTES',
    accion: 'GENERAR',
    entidadId: null,
    usuarioId: usuario.id,
    detalle: {
      codigo: definicion.codigo,
      formato,
      filtros: Object.keys(filtros),
    },
  });

  return descarga;
};

const mapearGeneracion = (fila: {
  id: number;
  codigo: string;
  formato: string;
  parametros: Prisma.JsonValue | null;
  estado: ReporteGeneracionResumen['estado'];
  error: string | null;
  nombreArchivo: string | null;
  tamano: number | null;
  creadoEn: Date;
  iniciadoEn: Date | null;
  terminadoEn: Date | null;
}): ReporteGeneracionResumen => ({
  id: fila.id,
  codigo: fila.codigo,
  formato: fila.formato as FormatoReporte,
  parametros:
    fila.parametros !== null &&
    typeof fila.parametros === 'object' &&
    !Array.isArray(fila.parametros)
      ? (fila.parametros as Record<string, unknown>)
      : null,
  estado: fila.estado,
  error: fila.error,
  nombreArchivo: fila.nombreArchivo,
  tamano: fila.tamano,
  creadoEn: fila.creadoEn,
  iniciadoEn: fila.iniciadoEn,
  terminadoEn: fila.terminadoEn,
});

export const crearGeneracionProgramada = async (
  programacion: {
    id: number;
    codigo: string;
    formato: string;
    parametros: Prisma.JsonValue | null;
    usuarioId: string;
  }
): Promise<ReporteGeneracionResumen> => {
  const definicion = obtenerDefinicionReporte(programacion.codigo);
  if (!definicion) throw new Error('Reporte no encontrado');

  const formato = resolverFormato(definicion, programacion.formato);
  const usuario = await prisma.usuario.findUnique({
    where: { id: programacion.usuarioId },
    select: { id: true, nombre: true, email: true, activo: true },
  });
  if (!usuario?.activo) throw new Error('El usuario ya no está activo');

  await validarPermisosReporte(definicion, usuario.id);

  const parametros =
    programacion.parametros &&
    typeof programacion.parametros === 'object' &&
    !Array.isArray(programacion.parametros)
      ? (programacion.parametros as Record<string, unknown>)
      : {};
  definicion.validarFiltros(parametros);

  const generacion = await prisma.reporteGenerado.create({
    data: {
      codigo: definicion.codigo,
      formato,
      parametros: parametros as Prisma.InputJsonValue,
      usuarioId: usuario.id,
      reporteProgramadoId: programacion.id,
    },
  });

  await procesarGeneracion(generacion.id);

  const fila = await prisma.reporteGenerado.findUnique({
    where: { id: generacion.id },
  });
  if (!fila) throw new Error('No se pudo recuperar la generación programada');
  return mapearGeneracion(fila);
};

export const crearGeneracionReporte = async (
  codigo: string,
  formatoQuery: unknown,
  query: Record<string, unknown>,
  usuario: UsuarioAuth
): Promise<ReporteGeneracionResumen> => {
  const definicion = obtenerDefinicionReporte(codigo);
  if (!definicion) {
    throw new HttpError(404, 'Reporte no encontrado', [
      { campo: 'codigo', valor: codigo },
    ]);
  }

  const formato = resolverFormato(definicion, formatoQuery);
  await validarPermisosReporte(definicion, usuario.id);
  definicion.validarFiltros(query);

  const generacion = await prisma.reporteGenerado.create({
    data: {
      codigo: definicion.codigo,
      formato,
      parametros: query as Prisma.InputJsonValue,
      usuarioId: usuario.id,
    },
  });

  setImmediate(() => {
    void procesarGeneracion(generacion.id);
  });

  return mapearGeneracion(generacion);
};

export const procesarGeneracion = async (id: number): Promise<void> => {
  const reclamo = await prisma.reporteGenerado.updateMany({
    where: { id, estado: 'PENDIENTE' },
    data: {
      estado: 'GENERANDO',
      iniciadoEn: new Date(),
      error: null,
    },
  });
  if (reclamo.count === 0) return;

  const generacion = await prisma.reporteGenerado.findUnique({
    where: { id },
  });
  if (!generacion) return;

  try {
    const definicion = obtenerDefinicionReporte(generacion.codigo);
    if (!definicion) throw new Error('Reporte no encontrado');

    const usuario = await prisma.usuario.findUnique({
      where: { id: generacion.usuarioId },
      select: { id: true, nombre: true, email: true, activo: true },
    });
    if (!usuario?.activo) throw new Error('El usuario ya no está activo');

    await validarPermisosReporte(definicion, usuario.id);

    const formato = generacion.formato as FormatoReporte;
    const parametros =
      generacion.parametros &&
      typeof generacion.parametros === 'object' &&
      !Array.isArray(generacion.parametros)
        ? (generacion.parametros as Record<string, unknown>)
        : {};
    const filtros = definicion.validarFiltros(parametros);
    const descarga = await construirDescarga(
      definicion,
      formato,
      filtros,
      usuario
    );

    await asegurarBucket(BUCKET_REPORTES);
    const key = `reportes/${usuario.id}/${id}-${descarga.filename}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_REPORTES,
        Key: key,
        Body: descarga.buffer,
        ContentType: descarga.contentType,
      })
    );

    await prisma.reporteGenerado.update({
      where: { id },
      data: {
        estado: 'COMPLETADO',
        s3Bucket: BUCKET_REPORTES,
        s3Key: key,
        nombreArchivo: descarga.filename,
        tamano: descarga.buffer.length,
        terminadoEn: new Date(),
        error: null,
      },
    });

    await registrarAuditoria(prisma, {
      modulo: 'REPORTES',
      accion: 'GENERAR',
      entidadId: id,
      usuarioId: usuario.id,
      detalle: {
        codigo: definicion.codigo,
        formato,
        filtros: Object.keys(filtros),
        asincrono: true,
      },
    });
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : 'Error al generar el reporte';
    console.error(`[REPORTES] Falló la generación ${id}:`, error);
    await prisma.reporteGenerado.update({
      where: { id },
      data: {
        estado: 'FALLIDO',
        error: mensaje.slice(0, 2000),
        terminadoEn: new Date(),
      },
    });
  }
};

export const listarGeneraciones = async (
  usuarioId: string,
  parametros: ParametrosListadoGeneraciones
): Promise<ResultadoListadoGeneraciones> => {
  const where = { usuarioId };
  const [filas, total] = await Promise.all([
    prisma.reporteGenerado.findMany({
      where,
      orderBy: [{ creadoEn: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
    }),
    prisma.reporteGenerado.count({ where }),
  ]);

  return {
    generaciones: filas.map(mapearGeneracion),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / parametros.limit)),
    },
  };
};

export const obtenerGeneracion = async (
  id: number,
  usuarioId: string
): Promise<ReporteGeneracionResumen> => {
  const fila = await prisma.reporteGenerado.findFirst({
    where: { id, usuarioId },
  });
  if (!fila) {
    throw new HttpError(404, 'Generación de reporte no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  return mapearGeneracion(fila);
};

export const descargarGeneracion = async (
  id: number,
  usuarioId: string
): Promise<DescargaReporteGenerado> => {
  const fila = await prisma.reporteGenerado.findFirst({
    where: { id, usuarioId },
    select: {
      id: true,
      estado: true,
      s3Bucket: true,
      s3Key: true,
    },
  });
  if (!fila) {
    throw new HttpError(404, 'Generación de reporte no encontrada', [
      { campo: 'id', valor: id },
    ]);
  }
  if (
    fila.estado !== 'COMPLETADO' ||
    fila.s3Bucket === null ||
    fila.s3Key === null
  ) {
    throw new HttpError(409, 'El reporte todavía no está disponible', [
      { campo: 'estado', valor: fila.estado },
    ]);
  }

  try {
    const url = await getSignedUrl(
      s3Presign,
      new GetObjectCommand({
        Bucket: fila.s3Bucket,
        Key: fila.s3Key,
      }),
      { expiresIn: TTL_DESCARGA }
    );
    return {
      url,
      expiraEn: new Date(Date.now() + TTL_DESCARGA * 1000).toISOString(),
    };
  } catch (error) {
    console.error('[REPORTES] No se pudo generar la URL de descarga', error);
    throw new HttpError(503, 'No se pudo generar la URL de descarga');
  }
};
