import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true';

process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST?.trim() ||
  'mysql://gestion_ti:gestion_ti_pass@127.0.0.1:3306/gestion_ti_test';

process.env.JWT_SECRET =
  process.env.JWT_SECRET?.trim() || 'secreto-de-pruebas-gestion-ti';
process.env.JWT_EXPIRES_IN = '1h';

process.env.AES_SECRET_KEY =
  process.env.AES_SECRET_KEY?.trim() ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test';
process.env.AWS_SECRET_ACCESS_KEY =
  process.env.AWS_SECRET_ACCESS_KEY || 'test';
process.env.AWS_ENDPOINT_URL =
  process.env.AWS_ENDPOINT_URL || 'http://127.0.0.1:4566';
process.env.S3_BUCKET = process.env.S3_BUCKET || 'gestion-ti-test';
process.env.S3_BUCKET_REPORTES =
  process.env.S3_BUCKET_REPORTES || 'gestion-ti-reportes-test';
