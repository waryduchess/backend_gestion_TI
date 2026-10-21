import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { EstadoActivo, Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import {
  asegurarBucket,
  BUCKET_ADJUNTOS,
  s3,
  s3Presign,
} from '../config/s3';
import { HttpError } from '../middlewares/error.middleware';
import {
  AdjuntoResumen,
  DatosCreacionAdjunto,
  DescargaAdjunto,
  ParametrosListadoAdjuntos,
  ResultadoListadoAdjuntos,
} from '../models/adjunto.model';
import { registrarAuditoria } from './auditoria.service';
import {
  crearClaveAdjunto,
  EXTENSION_POR_MIME,
  nombreArchivoSeguro,
} from '../utils/archivo';
import {
  filtroProyectosVisibles,
  puedeVerTodosProyectos,
} from '../utils/proyecto-visibilidad';

const validarEntidad = async (
  entidadTipo: DatosCreacionAdjunto['entidadTipo'],
  entidadId: string,
  usuarioId: string
): Promise<number> => {
  if (!/^[1-9]\d*$/.test(entidadId)) {
    throw new HttpError(400, 'El campo "entidadId" debe ser un entero positivo', [
      { campo: 'entidadId', valor: entidadId },
    ]);
  }

  const id = Number(entidadId);
  if (!Number.isSafeInteger(id) || id > 2147483647) {
    throw new HttpError(400, 'El campo "entidadId" está fuera de rango', [
      { campo: 'entidadId', valor: entidadId },
    ]);
  }

  let existe = false;

  switch (entidadTipo) {
    case 'ACTIVO':
      existe =
        (await prisma.activo.findFirst({
          where: {
            id,
            estado: { not: EstadoActivo.DE_BAJA },
          },
          select: { id: true },
        })) !== null;
      break;
    case 'MANTENIMIENTO':
      existe =
        (await prisma.ordenMantenimiento.findFirst({
          where: { id, activo: true },
          select: { id: true },
        })) !== null;
      break;
    case 'INCIDENCIA':
      existe =
        (await prisma.incidencia.findUnique({
          where: { id },
          select: { id: true },
        })) !== null;
      break;
    case 'PROYECTO': {
      const verTodos = await puedeVerTodosProyectos(usuarioId);
      existe =
        (await prisma.proyecto.findFirst({
          where: {
            id,
            activo: true,
            ...filtroProyectosVisibles(usuarioId, verTodos),
          },
          select: { id: true },
        })) !== null;
      break;
    }
  }

  if (!existe) {
    throw new HttpError(
      404,
      'La entidad asociada no existe o no está disponible',
      [{ campo: 'entidadId', valor: entidadId }]
    );
  }

  return id;
};

const mapearAdjunto = (fila: {
  id: number;
  entidadTipo: DatosCreacionAdjunto['entidadTipo'];
  entidadId: string;
  nombreOriginal: string;
  mimeType: string;
  extension: string;
  tamano: number;
  subidoEn: Date;
}): AdjuntoResumen => ({
  id: fila.id,
  entidadTipo: fila.entidadTipo,
  entidadId: fila.entidadId,
  nombreOriginal: fila.nombreOriginal,
  mimeType: fila.mimeType,
  extension: fila.extension,
  tamano: fila.tamano,
  subidoEn: fila.subidoEn,
});

const ttlConfigurado = Number(process.env.S3_PRESIGN_TTL_SECONDS);
const TTL_DESCARGA =
  Number.isSafeInteger(ttlConfigurado) && ttlConfigurado > 0
    ? Math.min(Math.max(ttlConfigurado, 60), 3600)
    : 300;

export const listarAdjuntos = async (
  parametros: ParametrosListadoAdjuntos,
  usuarioId: string
): Promise<ResultadoListadoAdjuntos> => {
  const entidadId = String(
    await validarEntidad(
      parametros.entidadTipo,
      parametros.entidadId,
      usuarioId
    )
  );
  const where: Prisma.AdjuntoWhereInput = {
    entidadTipo: parametros.entidadTipo,
    entidadId,
  };

  const [filas, total] = await Promise.all([
    prisma.adjunto.findMany({
      where,
      orderBy: [{ subidoEn: 'desc' }, { id: 'desc' }],
      skip: (parametros.page - 1) * parametros.limit,
      take: parametros.limit,
      select: {
        id: true,
        entidadTipo: true,
        entidadId: true,
        nombreOriginal: true,
        mimeType: true,
        extension: true,
        tamano: true,
        subidoEn: true,
      },
    }),
    prisma.adjunto.count({ where }),
  ]);

  return {
    adjuntos: filas.map(mapearAdjunto),
    meta: {
      page: parametros.page,
      limit: parametros.limit,
      total,
      totalPages: Math.ceil(total / parametros.limit),
    },
  };
};

const validarAccesoAdjunto = async (
  entidadTipo: DatosCreacionAdjunto['entidadTipo'],
  entidadId: string,
  usuarioId: string
): Promise<void> => {
  if (entidadTipo === 'PROYECTO') {
    await validarEntidad('PROYECTO', entidadId, usuarioId);
  }
};

export const generarUrlDescarga = async (
  id: number,
  usuarioId: string
): Promise<DescargaAdjunto> => {
  const fila = await prisma.adjunto.findUnique({
    where: { id },
    select: {
      id: true,
      entidadTipo: true,
      entidadId: true,
      s3Bucket: true,
      s3Key: true,
    },
  });
  if (!fila) {
    throw new HttpError(404, 'Adjunto no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  await validarAccesoAdjunto(fila.entidadTipo, fila.entidadId, usuarioId);

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
    console.error('[S3] No se pudo generar la URL de descarga', error);
    throw new HttpError(503, 'No se pudo generar la URL de descarga');
  }
};

export const eliminarAdjunto = async (
  id: number,
  usuarioId: string
): Promise<void> => {
  const fila = await prisma.adjunto.findUnique({
    where: { id },
    select: {
      id: true,
      entidadTipo: true,
      entidadId: true,
      s3Bucket: true,
      s3Key: true,
    },
  });
  if (!fila) {
    throw new HttpError(404, 'Adjunto no encontrado', [
      { campo: 'id', valor: id },
    ]);
  }
  await validarAccesoAdjunto(fila.entidadTipo, fila.entidadId, usuarioId);

  try {
    await s3.send(
      new DeleteObjectCommand({
        Bucket: fila.s3Bucket,
        Key: fila.s3Key,
      })
    );
  } catch (error) {
    console.error('[S3] No se pudo eliminar el objeto adjunto', error);
    throw new HttpError(503, 'No se pudo eliminar la imagen de S3');
  }

  await prisma.$transaction(async (tx) => {
    await tx.adjunto.delete({ where: { id } });
    await registrarAuditoria(tx, {
      modulo: 'ADJUNTOS',
      accion: 'ELIMINAR',
      entidadId: id,
      usuarioId,
    });
  });
};

export const crearAdjunto = async (
  usuarioId: string,
  datos: DatosCreacionAdjunto
): Promise<AdjuntoResumen> => {
  const entidadId = await validarEntidad(
    datos.entidadTipo,
    datos.entidadId,
    usuarioId
  );
  const mimeType = datos.archivo.mimetype.toLowerCase();
  const extension = EXTENSION_POR_MIME[mimeType] ?? '.bin';
  const key = crearClaveAdjunto(datos.entidadTipo, String(entidadId), mimeType);

  try {
    await asegurarBucket();
  } catch (error) {
    console.error('[S3] No se pudo asegurar el bucket', error);
    throw new HttpError(503, 'El almacenamiento S3 no está disponible');
  }

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_ADJUNTOS,
        Key: key,
        Body: datos.archivo.buffer,
        ContentType: mimeType,
        Metadata: {
          entidadTipo: datos.entidadTipo,
          entidadId: String(entidadId),
          subidoPorId: usuarioId,
        },
      })
    );
  } catch (error) {
    console.error('[S3] No se pudo subir la imagen', error);
    throw new HttpError(503, 'No se pudo guardar la imagen en S3');
  }

  try {
    const fila = await prisma.$transaction(async (tx) => {
      const adjunto = await tx.adjunto.create({
        data: {
          entidadTipo: datos.entidadTipo,
          entidadId: String(entidadId),
          s3Bucket: BUCKET_ADJUNTOS,
          s3Key: key,
          nombreOriginal: nombreArchivoSeguro(datos.archivo.originalname),
          mimeType,
          extension,
          tamano: datos.archivo.size,
          subidoPorId: usuarioId,
        },
      });

      await registrarAuditoria(tx, {
        modulo: 'ADJUNTOS',
        accion: 'CREAR',
        entidadId: adjunto.id,
        usuarioId,
        detalle: {
          campos: [
            'entidadTipo',
            'entidadId',
            'nombreOriginal',
            'mimeType',
            'extension',
            'tamano',
          ],
        },
      });

      return adjunto;
    });

    return mapearAdjunto(fila);
  } catch (error) {
    await s3
      .send(new DeleteObjectCommand({ Bucket: BUCKET_ADJUNTOS, Key: key }))
      .catch((limpiezaError: unknown) => {
        console.error('[S3] No se pudo limpiar el objeto huérfano', limpiezaError);
      });
    throw error;
  }
};
