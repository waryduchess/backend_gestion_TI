import { Server as HttpServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import { prisma } from './prisma';
import {
  EstadoIncidenciaValor,
  PrioridadValor,
} from '../models/incidencia.model';
import {
  MantenimientoEstado,
  MantenimientoPrioridad,
  MantenimientoTipo,
} from '../generated/prisma/client';
import { verificarToken } from '../utils/jwt';
import {
  calcularPermisosEfectivos,
  normalizarPermisos,
} from '../utils/permisos';

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

export interface MantenimientoEvento {
  id: number;
  folio: string;
  activoId: number;
  estado: MantenimientoEstado;
  tipo: MantenimientoTipo;
  prioridad: MantenimientoPrioridad;
  tecnicoId: string;
  fechaProgramada: string;
}

export interface MantenimientoActualizadoEvento
  extends MantenimientoEvento {
  estadoAnterior: MantenimientoEstado;
}

export interface MantenimientoEliminadoEvento {
  id: number;
  folio: string;
  activoId: number;
}

interface EventosServidor {
  'incidencias:nueva': (incidencia: IncidenciaNueva) => void;
  'incidencias:estado-cambiado': (cambio: CambioEstadoIncidencia) => void;
  'licencias:por-vencer': (recordatorio: RecordatorioLicencia) => void;
  'mantenimiento:creado': (evento: MantenimientoEvento) => void;
  'mantenimiento:actualizado': (
    evento: MantenimientoActualizadoEvento
  ) => void;
  'mantenimiento:eliminado': (evento: MantenimientoEliminadoEvento) => void;
}

interface DatosSocket {
  usuarioId: string;
  puedeLeerIncidencias: boolean;
  puedeLeerMantenimiento: boolean;
}

const SALA_INCIDENCIAS = 'incidencias';
const SALA_MANTENIMIENTO = 'mantenimiento';
type SocketIo = SocketIoServer<
  Record<string, never>,
  EventosServidor,
  Record<string, never>,
  DatosSocket
>;

let socketIo: SocketIo | undefined;

const salaUsuario = (usuarioId: string): string => `usuario:${usuarioId}`;

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
          permisosExtra: true,
          permisosRevocados: true,
          rol: {
            select: {
              activo: true,
              permisos: true,
            },
          },
        },
      })
      .then((usuario) => {
        if (!usuario?.activo || !usuario.rol?.activo) {
          next(new Error('No tienes permiso para recibir notificaciones'));
          return;
        }

        const permisosRol = normalizarPermisos(
          usuario.rol.permisos,
          `El rol del usuario ${usuarioId}`
        );
        const permisosExtra = normalizarPermisos(
          usuario.permisosExtra,
          `El usuario ${usuarioId} (permisosExtra)`
        );
        const permisosRevocados = normalizarPermisos(
          usuario.permisosRevocados,
          `El usuario ${usuarioId} (permisosRevocados)`
        );
        const permisos = calcularPermisosEfectivos(
          permisosRol,
          permisosExtra,
          permisosRevocados
        );

        const puedeLeerIncidencias =
          permisos.includes('incidencias:leer') &&
          permisos.includes('notificaciones:leer');
        const puedeLeerNotificaciones =
          permisos.includes('notificaciones:leer');
        const puedeLeerMantenimiento =
          permisos.includes('mantenimiento:leer');
        if (
          !puedeLeerIncidencias &&
          !puedeLeerNotificaciones &&
          !puedeLeerMantenimiento
        ) {
          next(new Error('No tienes permiso para recibir notificaciones'));
          return;
        }

        socket.data.usuarioId = usuarioId;
        socket.data.puedeLeerIncidencias = puedeLeerIncidencias;
        socket.data.puedeLeerMantenimiento = puedeLeerMantenimiento;
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
    if (socket.data.puedeLeerMantenimiento) {
      socket.join(SALA_MANTENIMIENTO);
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

export const emitirMantenimientoCreado = (
  evento: MantenimientoEvento
): void => {
  obtenerSocketIo().to(SALA_MANTENIMIENTO).emit('mantenimiento:creado', evento);
};

export const emitirMantenimientoActualizado = (
  evento: MantenimientoActualizadoEvento
): void => {
  obtenerSocketIo()
    .to(SALA_MANTENIMIENTO)
    .emit('mantenimiento:actualizado', evento);
};

export const emitirMantenimientoEliminado = (
  evento: MantenimientoEliminadoEvento
): void => {
  obtenerSocketIo()
    .to(SALA_MANTENIMIENTO)
    .emit('mantenimiento:eliminado', evento);
};
