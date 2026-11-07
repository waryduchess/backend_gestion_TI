import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as crearCliente, type Socket } from 'socket.io-client';
import { createApp } from '../../src/app.factory';
import { prisma } from '../../src/config/prisma';
import {
  emitirCambioEstadoIncidencia,
  emitirIncidenciaNueva,
  inicializarSocketIo,
} from '../../src/config/socket';
import {
  crearContextoPrueba,
  limpiarBaseDeDatos,
  type ContextoPrueba,
} from '../helpers/db';

let servidor: Server;
let url: string;
let contexto: ContextoPrueba;
let socketIo: ReturnType<typeof inicializarSocketIo>;
const clientes: Socket[] = [];

const esperarConexion = (socket: Socket): Promise<void> =>
  new Promise((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error('Tiempo de espera de conexion agotado')),
      5000
    );
    socket.once('connect', () => {
      clearTimeout(temporizador);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(temporizador);
      reject(error);
    });
  });

const esperarErrorConexion = (socket: Socket): Promise<string> =>
  new Promise((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error('Tiempo de espera de error de conexion agotado')),
      5000
    );
    socket.once('connect', () => {
      clearTimeout(temporizador);
      reject(new Error('La conexion no debio completarse'));
    });
    socket.once('connect_error', (error) => {
      clearTimeout(temporizador);
      resolve(error.message);
    });
  });

const esperarEvento = <T>(socket: Socket, evento: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const temporizador = setTimeout(
      () => reject(new Error(`Tiempo de espera agotado para ${evento}`)),
      5000
    );
    socket.once(evento, (datos: T) => {
      clearTimeout(temporizador);
      resolve(datos);
    });
  });

beforeAll(async () => {
  await limpiarBaseDeDatos();
  contexto = await crearContextoPrueba();

  const app = createApp();
  servidor = createServer(app);
  socketIo = inicializarSocketIo(servidor);

  await new Promise<void>((resolve) => {
    servidor.listen(0, '127.0.0.1', () => resolve());
  });

  const direccion = servidor.address() as AddressInfo;
  url = `http://127.0.0.1:${direccion.port}`;
});

afterEach(() => {
  while (clientes.length > 0) {
    clientes.pop()?.disconnect();
  }
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    socketIo.close(() => resolve());
  });

  if (servidor.listening) {
    await new Promise<void>((resolve, reject) => {
      servidor.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  await limpiarBaseDeDatos();
  await prisma.$disconnect();
});

describe('Socket.IO', () => {
  it('autentica una conexion con token valido', async () => {
    const socket = crearCliente(url, {
      auth: { token: contexto.tokenAdmin },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clientes.push(socket);

    await esperarConexion(socket);

    expect(socket.connected).toBe(true);
  });

  it('rechaza una conexion sin token', async () => {
    const socket = crearCliente(url, {
      auth: {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clientes.push(socket);

    await expect(esperarErrorConexion(socket)).resolves.toContain(
      'Token de acceso no proporcionado'
    );
  });

  it('rechaza una conexion con token invalido', async () => {
    const socket = crearCliente(url, {
      auth: { token: 'token-invalido' },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clientes.push(socket);

    await expect(esperarErrorConexion(socket)).resolves.toContain(
      'Token de acceso invalido o expirado'
    );
  });

  it('entrega una incidencia nueva al usuario destinatario', async () => {
    const socket = crearCliente(url, {
      auth: { token: contexto.tokenAdmin },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clientes.push(socket);
    await esperarConexion(socket);

    const evento = esperarEvento<{ id: number; notificacionId: number }>(
      socket,
      'incidencias:nueva'
    );

    emitirIncidenciaNueva(contexto.adminId, {
      id: 101,
      titulo: 'Incidencia en tiempo real',
      estado: 'NUEVO',
      prioridad: 'NORMAL',
      fechaNotificacion: new Date().toISOString(),
      notificacionId: 55,
    });

    await expect(evento).resolves.toMatchObject({
      id: 101,
      titulo: 'Incidencia en tiempo real',
      notificacionId: 55,
    });
  });

  it('entrega cambios de estado a la sala de incidencias', async () => {
    const socket = crearCliente(url, {
      auth: { token: contexto.tokenAdmin },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    clientes.push(socket);
    await esperarConexion(socket);

    const evento = esperarEvento<{ id: number; estado: string }>(
      socket,
      'incidencias:estado-cambiado'
    );

    emitirCambioEstadoIncidencia({
      id: 101,
      titulo: 'Incidencia en tiempo real',
      estadoAnterior: 'NUEVO',
      estado: 'COMPLETADO',
      fechaCambio: new Date().toISOString(),
    });

    await expect(evento).resolves.toMatchObject({
      id: 101,
      estadoAnterior: 'NUEVO',
      estado: 'COMPLETADO',
    });
  });
});
