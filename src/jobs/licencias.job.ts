import cron from 'node-cron';
import { prisma } from '../config/prisma';
import { enviarCorreo } from '../config/mailer';
import { PERMISOS_DISPONIBLES } from '../models/rol.model';
import { crearRecordatoriosLicencia } from '../services/notificacion.service';

const DIAS_ANTICIPACION = 30;
const HITOS_RECORDATORIO = [30, 7, 1] as const;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const ZONA_HORARIA = 'America/Cancun';
let jobIniciado = false;

const tienePermiso = (permisos: unknown, permiso: string): boolean =>
  Array.isArray(permisos) &&
  permisos.every(
    (valor) =>
      typeof valor === 'string' &&
      PERMISOS_DISPONIBLES.some((permitido) => permitido === valor)
  ) &&
  permisos.includes(permiso);

const obtenerDiasRestantes = (fecha: Date, inicioDia: Date): number =>
  Math.ceil((fecha.getTime() - inicioDia.getTime()) / MILISEGUNDOS_POR_DIA);

const obtenerHito = (diasRestantes: number): number | undefined => {
  if (diasRestantes < 0 || diasRestantes > DIAS_ANTICIPACION) return undefined;
  return HITOS_RECORDATORIO.slice().reverse().find(
    (hito) => diasRestantes <= hito
  );
};

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

export const crearNotificacionesVencimientoLicencias = async (
  ahora: Date = new Date()
): Promise<{ creadas: number; fallidas: number }> => {
  const inicioDia = new Date(ahora);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finVentana = new Date(inicioDia);
  finVentana.setUTCDate(finVentana.getUTCDate() + DIAS_ANTICIPACION);

  const licenciasRecordatorio = await prisma.licencia.findMany({
    where: {
      activa: true,
      fechaVencimiento: { gte: inicioDia, lte: finVentana },
    },
    select: {
      id: true,
      software: true,
      fechaVencimiento: true,
      asignadaA: {
        select: {
          id: true,
          activo: true,
          rol: { select: { activo: true, permisos: true } },
        },
      },
    },
    orderBy: { fechaVencimiento: 'asc' },
  });
  const administradoresLicencias = await prisma.usuario.findMany({
    where: { activo: true, rol: { is: { activo: true } } },
    select: {
      id: true,
      rol: { select: { permisos: true } },
    },
  });
  const destinatariosRespaldo = administradoresLicencias
    .filter(
      (usuario) =>
        tienePermiso(usuario.rol?.permisos, 'licencias:administrar') &&
        tienePermiso(usuario.rol?.permisos, 'notificaciones:leer')
    )
    .map((usuario) => usuario.id);

  let creadas = 0;
  let fallidas = 0;
  for (const licencia of licenciasRecordatorio) {
    const diasRestantes = obtenerDiasRestantes(
      licencia.fechaVencimiento,
      inicioDia
    );
    const hitoDias = obtenerHito(diasRestantes);
    if (hitoDias === undefined) continue;

    const asignado = licencia.asignadaA;
    const destinatarios =
      asignado?.activo &&
      asignado.rol?.activo &&
      tienePermiso(asignado.rol.permisos, 'notificaciones:leer')
        ? [asignado.id]
        : destinatariosRespaldo;
    if (destinatarios.length === 0) continue;

    try {
      creadas += await crearRecordatoriosLicencia({
        usuarioIds: destinatarios,
        licenciaId: licencia.id,
        software: licencia.software,
        fechaVencimiento: licencia.fechaVencimiento,
        diasRestantes,
        hitoDias,
        creadaEn: ahora,
      });
    } catch (error: unknown) {
      fallidas += 1;
      console.error(
        `Fallo al crear notificacion de vencimiento para la licencia ${licencia.id}:`,
        error
      );
    }
  }

  return { creadas, fallidas };
};

export const enviarAlertasVencimientoLicencias = async (
  ahora: Date = new Date()
): Promise<{
  enviadas: number;
  fallidas: number;
  notificacionesCreadas: number;
  notificacionesFallidas: number;
}> => {
  const inicioDia = new Date(ahora);
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finVentana = new Date(inicioDia);
  finVentana.setUTCDate(finVentana.getUTCDate() + DIAS_ANTICIPACION);
  const resultadoNotificaciones =
    await crearNotificacionesVencimientoLicencias(ahora);

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

  return {
    enviadas,
    fallidas,
    notificacionesCreadas: resultadoNotificaciones.creadas,
    notificacionesFallidas: resultadoNotificaciones.fallidas,
  };
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
        .then(
          ({
            enviadas,
            fallidas,
            notificacionesCreadas,
            notificacionesFallidas,
          }) => {
            if (
              enviadas > 0 ||
              fallidas > 0 ||
              notificacionesCreadas > 0 ||
              notificacionesFallidas > 0
            ) {
              console.info(
                `Alertas de licencias: ${enviadas} correos enviados, ${fallidas} fallidos; ${notificacionesCreadas} notificaciones creadas, ${notificacionesFallidas} fallidas`
              );
            }
          }
        )
        .catch((error: unknown) => {
          console.error('Fallo el job de alertas de vencimiento de licencias:', error);
        });
    },
    { timezone: ZONA_HORARIA, noOverlap: true }
  );
  jobIniciado = true;
};
