import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.factory';
import { iniciarJobAlertasLicencias } from './jobs/licencias.job';
import { inicializarSocketIo } from './config/socket';
import {
  asegurarBucket,
  BUCKET_ADJUNTOS,
  BUCKET_REPORTES,
} from './config/s3';
import { recuperarGeneracionesPendientes } from './services/reportes/reporte-recovery.service';
import { iniciarJobReportesProgramados } from './jobs/reportes.job';

const app = createApp();
const servidor = createServer(app);
inicializarSocketIo(servidor);

const PORT = Number(process.env.PORT) || 3000;

servidor.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  iniciarJobAlertasLicencias();
  void Promise.all([
    asegurarBucket(),
    asegurarBucket(BUCKET_REPORTES),
  ])
    .then(async () => {
      console.log(`[S3] Buckets listos: ${BUCKET_ADJUNTOS}, ${BUCKET_REPORTES}`);
      iniciarJobReportesProgramados();
      const resultado = await recuperarGeneracionesPendientes();
      if (
        resultado.reiniciadas > 0 ||
        resultado.procesadas > 0 ||
        resultado.fallidas > 0
      ) {
        console.info(
          `[REPORTES] Recuperación: ${resultado.reiniciadas} reiniciadas, ` +
            `${resultado.procesadas} completadas, ${resultado.fallidas} fallidas`
        );
      }
    })
    .catch((error: unknown) => {
      console.error('[S3] No se pudo inicializar el almacenamiento', error);
    });
});

export default app;
