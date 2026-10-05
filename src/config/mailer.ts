import nodemailer, { Transporter } from 'nodemailer';

let transporter: Transporter | undefined;

const leerConfiguracion = (): {
  host: string;
  port: number;
  secure: boolean;
  from: string;
} => {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const port = Number(process.env.SMTP_PORT);
  const secureRaw = process.env.SMTP_SECURE ?? 'false';
  if (secureRaw !== 'true' && secureRaw !== 'false') {
    throw new Error('SMTP_SECURE debe ser true o false');
  }
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;
  if ((user && !pass) || (!user && pass)) {
    throw new Error('SMTP_USER y SMTP_PASS deben configurarse juntos');
  }

  if (!host || !from || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      'SMTP_HOST, SMTP_FROM y un SMTP_PORT valido son obligatorios para enviar correos'
    );
  }
  return { host, port, secure: secureRaw === 'true', from };
};

const obtenerTransporter = (): {
  transporter: Transporter;
  from: string;
} => {
  const configuracion = leerConfiguracion();
  if (!transporter) {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS;
    transporter = nodemailer.createTransport({
      host: configuracion.host,
      port: configuracion.port,
      secure: configuracion.secure,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }
  return { transporter, from: configuracion.from };
};

export const enviarCorreo = async (mensaje: {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}): Promise<void> => {
  const configuracion = obtenerTransporter();
  await configuracion.transporter.sendMail({
    from: configuracion.from,
    to: mensaje.para,
    subject: mensaje.asunto,
    text: mensaje.texto,
    html: mensaje.html,
  });
};
