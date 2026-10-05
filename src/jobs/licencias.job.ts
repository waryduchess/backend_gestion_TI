import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { enviarCorreo } from '../config/mailer';

const DIAS_ANTICIPACION = 30;
const ZONA_HORARIA = 'America/Cancun';
let jobIniciado = false;

const escaparHtml = (valor: string): string =>
  valor.replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter] ?? caracter;
  });

export const enviarAlertasVencimientoLicencias = async (
  ahora: Date = new Date()
): Promise<{ enviadas: number; fallidas: number }> => {
  const inicioDia = new Date(ahora);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finVentana = new Date(inicioDia);
  finVentana.setUTCDate(finVentana.getUTCDate() + DIAS_ANTICIPACION);

  const licencias = await prisma.licencia.findMany({
    where: {
      activa: true,
      fechaVencimiento: { gte: inicioDia, lte: finVentana },
      OR: [
        { ultimaAlertaVencimiento: null },
        { ultimaAlertaVencimiento: { lt: inicioDia } },
      ],
    },
    select: {
      id: true,
      software: true,
      proveedor: true,
      fechaVencimiento: true,
      asignadaA: { select: { email: true, activo: true } },
    },
    orderBy: { fechaVencimiento: 'asc' },
  });

  let enviadas = 0;
  let fallidas = 0;
  const respaldo = process.env.LICENCIAS_ALERTA_EMAIL?.trim();

  for (const licencia of licencias) {
    const destino =
      (licencia.asignadaA?.activo
        ? licencia.asignadaA.email?.trim() || null
        : null) ||
      respaldo;
    if (!destino) {
      fallidas += 1;
      console.error(
        `No se envio alerta de vencimiento para la licencia ${licencia.id}: no hay correo asignado ni LICENCIAS_ALERTA_EMAIL`
      );
      continue;
    }

    const fecha = licencia.fechaVencimiento.toISOString().slice(0, 10);
    const software = escaparHtml(licencia.software);
    const proveedor = licencia.proveedor
      ? escaparHtml(licencia.proveedor)
      : 'No especificado';
    try {
      await enviarCorreo({
        para: destino,
        asunto: `Vencimiento próximo de licencia: ${licencia.software}`,
        texto: [
          `La licencia de ${licencia.software} vence el ${fecha}.`,
          `Proveedor: ${licencia.proveedor ?? 'No especificado'}.`,
        ].join('\n'),
        html: `<p>La licencia de <strong>${software}</strong> vence el <strong>${fecha}</strong>.</p><p>Proveedor: ${proveedor}.</p>`,
      });
      await prisma.licencia.update({
        where: { id: licencia.id },
        data: { ultimaAlertaVencimiento: inicioDia },
      });
      enviadas += 1;
    } catch (error: unknown) {
      fallidas += 1;
      console.error(
        `Fallo al enviar o registrar alerta de vencimiento para la licencia ${licencia.id}:`,
        error
      );
    }
  }

  return { enviadas, fallidas };
};

export const iniciarJobAlertasLicencias = (): void => {
  if (jobIniciado) return;
  const expresion = process.env.LICENCIAS_ALERTA_CRON?.trim() || '0 9 * * *';
  if (!cron.validate(expresion)) {
    throw new Error('LICENCIAS_ALERTA_CRON no contiene una expresion cron valida');
  }

  cron.schedule(
    expresion,
    () => {
      void enviarAlertasVencimientoLicencias()
        .then(({ enviadas, fallidas }) => {
          if (enviadas > 0 || fallidas > 0) {
            console.info(
              `Alertas de licencias: ${enviadas} enviadas, ${fallidas} fallidas`
            );
          }
        })
        .catch((error: unknown) => {
          console.error('Fallo el job de alertas de vencimiento de licencias:', error);
        });
    },
    { timezone: ZONA_HORARIA, noOverlap: true }
  );
  jobIniciado = true;
};
