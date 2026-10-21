import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const endpoint = process.env.AWS_ENDPOINT_URL?.trim() || undefined;
const region =
  process.env.AWS_DEFAULT_REGION?.trim() ||
  process.env.AWS_REGION?.trim() ||
  'us-east-1';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

const credenciales =
  accessKeyId && secretAccessKey
    ? { accessKeyId, secretAccessKey }
    : undefined;

export const BUCKET_ADJUNTOS =
  process.env.S3_BUCKET?.trim() ||
  process.env.AWS_BUCKET_NAME?.trim() ||
  'gestion-ti-adjuntos';

export const S3_PUBLIC_ENDPOINT =
  process.env.S3_PUBLIC_ENDPOINT?.trim() || endpoint;

const opcionesCliente = {
  region,
  forcePathStyle:
    Boolean(endpoint) || process.env.S3_FORCE_PATH_STYLE === 'true',
  ...(credenciales ? { credentials: credenciales } : {}),
};

export const s3 = new S3Client({
  ...opcionesCliente,
  endpoint,
});

export const s3Presign = new S3Client({
  ...opcionesCliente,
  endpoint: S3_PUBLIC_ENDPOINT,
});

const esBucketInexistente = (error: unknown): boolean => {
  const detalle = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    detalle.name === 'NotFound' ||
    detalle.name === 'NoSuchBucket' ||
    detalle.$metadata?.httpStatusCode === 404
  );
};

const esBucketExistente = (error: unknown): boolean => {
  const detalle = error as { name?: string };
  return (
    detalle.name === 'BucketAlreadyOwnedByYou' ||
    detalle.name === 'BucketAlreadyExists'
  );
};

let bucketPendiente: Promise<void> | null = null;

export const asegurarBucket = (): Promise<void> => {
  if (bucketPendiente) return bucketPendiente;

  bucketPendiente = (async (): Promise<void> => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET_ADJUNTOS }));
      return;
    } catch (error) {
      if (!esBucketInexistente(error)) throw error;
    }

    try {
      await s3.send(new CreateBucketCommand({ Bucket: BUCKET_ADJUNTOS }));
    } catch (error) {
      if (!esBucketExistente(error)) throw error;
    }
  })().catch((error: unknown) => {
    bucketPendiente = null;
    throw error;
  });

  return bucketPendiente;
};
