import { prisma } from '../../config/prisma';
import { procesarGeneracion } from './reporte.service';

const timeoutConfigurado = Number(
  process.env.REPORTES_GENERANDO_TIMEOUT_MINUTOS
);
const TIMEOUT_MINUTOS =
  Number.isSafeInteger(timeoutConfigurado) && timeoutConfigurado > 0
    ? timeoutConfigurado
    : 5;

export interface ResultadoRecuperacionReportes {
  reiniciadas: number;
  procesadas: number;
  fallidas: number;
  omitida: boolean;
}

let recuperacionEnCurso = false;

export const recuperarGeneracionesPendientes =
  async (): Promise<ResultadoRecuperacionReportes> => {
    if (recuperacionEnCurso) {
      return {
        reiniciadas: 0,
        procesadas: 0,
        fallidas: 0,
        omitida: true,
      };
    }

    recuperacionEnCurso = true;

    try {
      const corte = new Date(Date.now() - TIMEOUT_MINUTOS * 60 * 1000);
      const reiniciadas = await prisma.reporteGenerado.updateMany({
        where: {
          estado: 'GENERANDO',
          OR: [{ iniciadoEn: null }, { iniciadoEn: { lt: corte } }],
        },
        data: {
          estado: 'PENDIENTE',
          iniciadoEn: null,
          error: null,
        },
      });

      const pendientes = await prisma.reporteGenerado.findMany({
        where: { estado: 'PENDIENTE' },
        orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });

      let procesadas = 0;
      let fallidas = 0;

      for (const pendiente of pendientes) {
        try {
          await procesarGeneracion(pendiente.id);
          const estado = await prisma.reporteGenerado.findUnique({
            where: { id: pendiente.id },
            select: { estado: true },
          });
          if (estado?.estado === 'COMPLETADO') procesadas += 1;
          else if (estado?.estado === 'FALLIDO') fallidas += 1;
        } catch (error) {
          fallidas += 1;
          console.error(
            `[REPORTES] Falló la recuperación de la generación ${pendiente.id}:`,
            error
          );
        }
      }

      return {
        reiniciadas: reiniciadas.count,
        procesadas,
        fallidas,
        omitida: false,
      };
    } finally {
      recuperacionEnCurso = false;
    }
  };
