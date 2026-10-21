import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { enviarCorreo } from '../config/mailer';
import {
  crearGeneracionProgramada,
  descargarGeneracion,
} from '../services/reportes/reporte.service';
import { escaparHtml } from '../services/reportes/renderers/comun';
import { Prisma } from '../generated/prisma/client';

const ZONA_HORARIA =
  process.env.REPORTES_CRON_TIMEZONE?.trim() || 'America/Cancun';
const tareas = new Map<number, ReturnType<typeof cron.schedule>>();

const destinatariosDe = (valor: Prisma.JsonValue): string[] =>
  Array.isArray(valor)
    ? valor.filter((item): item is string => typeof item === 'string')
    : [];

const ejecutarProgramacion = async (id: number): Promise<void> => {
  const programacion = await prisma.reporteProgramado.findUnique({
    where: { id },
  });
  if (!programacion?.activo) return;

  try {
    const generacion = await crearGeneracionProgramada(programacion);
    if (generacion.estado !== 'COMPLETADO') {
      throw new Error(generacion.error ?? 'No se pudo generar el reporte');
    }

    const destinatarios = destinatariosDe(programacion.destinatarios);
    if (destinatarios.length === 0) {
      throw new Error('La programación no tiene destinatarios');
    }

    const descarga = await descargarGeneracion(
      generacion.id,
      programacion.usuarioId
    );
    const reporte = escaparHtml(programacion.codigo);
    const url = escaparHtml(descarga.url);

    await enviarCorreo({
      para: destinatarios.join(','),
      asunto: `Reporte programado: ${programacion.codigo}`,
      texto: `El reporte ${programacion.codigo} está disponible en: ${descarga.url}`,
      html: `<p>El reporte <strong>${reporte}</strong> está disponible.</p><p><a href="${url}">Descargar reporte</a></p><p>La URL expira el ${escaparHtml(descarga.expiraEn)}.</p>`,
    });

    await prisma.reporteProgramado.update({
      where: { id },
      data: {
        ultimaEjecucion: new Date(),
        ultimoEstado: 'COMPLETADO',
        ultimoError: null,
      },
    });
  } catch (error) {
    const mensaje =
      error instanceof Error ? error.message : 'Error al ejecutar el reporte';
    console.error(
      `[REPORTES] Falló la programación ${id} (${programacion.codigo}):`,
      error
    );
    await prisma.reporteProgramado
      .update({
        where: { id },
        data: {
          ultimaEjecucion: new Date(),
          ultimoEstado: 'FALLIDO',
          ultimoError: mensaje.slice(0, 2000),
        },
      })
      .catch((errorActualizacion: unknown) => {
        console.error(
          `[REPORTES] No se pudo registrar el error de la programación ${id}:`,
          errorActualizacion
        );
      });
  }
};

export const recargarProgramacionesReportes = async (): Promise<void> => {
  for (const tarea of tareas.values()) tarea.stop();
  tareas.clear();

  const programaciones = await prisma.reporteProgramado.findMany({
    where: { activo: true },
    orderBy: { id: 'asc' },
  });

  for (const programacion of programaciones) {
    if (!cron.validate(programacion.cron)) {
      console.error(
        `[REPORTES] La programación ${programacion.id} tiene un cron inválido: ${programacion.cron}`
      );
      await prisma.reporteProgramado.update({
        where: { id: programacion.id },
        data: {
          ultimoEstado: 'FALLIDO',
          ultimoError: 'La expresión cron no es válida',
        },
      });
      continue;
    }

    try {
      const tarea = cron.schedule(
        programacion.cron,
        async () => {
          await ejecutarProgramacion(programacion.id);
        },
        { timezone: ZONA_HORARIA, noOverlap: true }
      );
      tareas.set(programacion.id, tarea);
    } catch (error) {
      console.error(
        `[REPORTES] No se pudo programar ${programacion.id}:`,
        error
      );
    }
  }

  console.info(
    `[REPORTES] Programaciones activas cargadas: ${tareas.size}`
  );
};

export const iniciarJobReportesProgramados = (): void => {
  void recargarProgramacionesReportes().catch((error: unknown) => {
    console.error('[REPORTES] No se pudo iniciar el scheduler', error);
  });
};
