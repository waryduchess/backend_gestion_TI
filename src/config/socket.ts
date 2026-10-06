import { Server as HttpServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import { prisma } from './prisma';
import {
  EstadoIncidenciaValor,
  PrioridadValor,
} from '../models/incidencia.model';
import { PERMISOS_DISPONIBLES, Permiso } from '../models/rol.model';
import { verificarToken } from '../utils/jwt';

interface IncidenciaNueva {
  id: number;
  titulo: string;
  estado: EstadoIncidenciaValor;
  prioridad: PrioridadValor;
  fechaNotificacion: string;
  notificacionId: number;
}

interface CambioEstadoIncidencia {
  id: number;
  titulo: string;
  estadoAnterior: EstadoIncidenciaValor;
  estado: EstadoIncidenciaValor;
  fechaCambio: string;
}

interface RecordatorioLicencia {
  notificacionId: number;
  licenciaId: number;
  software: string;
  fechaVencimiento: string;
  diasRestantes: number;
  hitoDias: number;
  creadaEn: string;
}

interface EventosServidor {
  'incidencias:nueva': (incidencia: IncidenciaNueva) => void;
  'incidencias:estado-cambiado': (cambio: CambioEstadoIncidencia) => void;
  'licencias:por-vencer': (recordatorio: RecordatorioLicencia) => void;
}

interface DatosSocket {
  usuarioId: string;
  puedeLeerIncidencias: boolean;
}

const SALA_INCIDENCIAS = 'incidencias';
type SocketIo = SocketIoServer<
  Record<string, never>,
  EventosServidor,
  Record<string, never>,
  DatosSocket
>;

let socketIo: SocketIo | undefined;

const salaUsuario = (usuarioId: string): string => `usuario:${usuarioId}`;

const esPermiso = (valor: unknown): valor is Permiso =>
  typeof valor === 'string' &&
  PERMISOS_DISPONIBLES.includes(valor as Permiso);

const obtenerOrigenesPermitidos = (): string | string[] => {
  const configuracion = process.env.SOCKET_CORS_ORIGIN?.trim();
  if (!configuracion) {
    return '*';
  }

  const origenes = configuracion
    .split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen.length > 0);

  if (origenes.length === 0) {
    throw new Error('SOCKET_CORS_ORIGIN debe contener al menos un origen valido');
  }
  return origenes;
};

export const inicializarSocketIo = (servidor: HttpServer): SocketIo => {
  if (socketIo) {
    throw new Error('Socket.IO ya fue inicializado');
  }

  const io = new SocketIoServer<
    Record<string, never>,
    EventosServidor,
    Record<string, never>,
    DatosSocket
  >(servidor, {
    cors: {
      origin: obtenerOrigenesPermitidos(),
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.trim() === '') {
      next(new Error('Token de acceso no proporcionado'));
      return;
    }

    let usuarioId: string;
    try {
      const payload = verificarToken(token.trim());
      if (typeof payload.sub !== 'string' || payload.sub.trim() === '') {
        next(new Error('Token de acceso invalido o expirado'));
        return;
      }
      usuarioId = payload.sub;
    } catch {
      next(new Error('Token de acceso invalido o expirado'));
      return;
    }

    void prisma.usuario
      .findUnique({
        where: { id: usuarioId },
        select: {
          activo: true,
          rol: {
            select: {
              activo: true,
              permisos: true,
            },
          },
        },
      })
      .then((usuario) => {
        if (
          !usuario?.activo ||
          !usuario.rol?.activo ||
          !Array.isArray(usuario.rol.permisos) ||
          !usuario.rol.permisos.every(esPermiso)
        ) {
          next(new Error('No tienes permiso para recibir notificaciones'));
          return;
        }

        const puedeLeerIncidencias =
          usuario.rol.permisos.includes('incidencias:leer') &&
          usuario.rol.permisos.includes('notificaciones:leer');
        const puedeLeerNotificaciones =
          usuario.rol.permisos.includes('notificaciones:leer');
        if (!puedeLeerIncidencias && !puedeLeerNotificaciones) {
          next(new Error('No tienes permiso para recibir notificaciones'));
          return;
        }

        socket.data.usuarioId = usuarioId;
        socket.data.puedeLeerIncidencias = puedeLeerIncidencias;
        next();
      })
      .catch((error: unknown) => {
        console.error('Error al autenticar conexion Socket.IO:', error);
        next(new Error('No fue posible validar la sesion'));
      });
  });

  io.on('connection', (socket) => {
    socket.join(salaUsuario(socket.data.usuarioId));
    if (socket.data.puedeLeerIncidencias) {
      socket.join(SALA_INCIDENCIAS);
    }
  });

  socketIo = io;
  return io;
};

const obtenerSocketIo = (): SocketIo => {
  if (!socketIo) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return socketIo;
};

export const emitirIncidenciaNueva = (
  usuarioId: string,
  incidencia: IncidenciaNueva
): void => {
  obtenerSocketIo()
    .to(salaUsuario(usuarioId))
    .emit('incidencias:nueva', incidencia);
};

export const emitirCambioEstadoIncidencia = (
  cambio: CambioEstadoIncidencia
): void => {
  obtenerSocketIo()
    .to(SALA_INCIDENCIAS)
    .emit('incidencias:estado-cambiado', cambio);
};

export const emitirRecordatorioLicencia = (
  usuarioId: string,
  recordatorio: RecordatorioLicencia
): void => {
  obtenerSocketIo()
    .to(salaUsuario(usuarioId))
    .emit('licencias:por-vencer', recordatorio);
};
