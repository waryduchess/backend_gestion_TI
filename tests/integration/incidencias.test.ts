import request from 'supertest';
import { createApp } from '../../src/app.factory';
import { prisma } from '../../src/config/prisma';
import {
  emitirCambioEstadoIncidencia,
  emitirIncidenciaNueva,
} from '../../src/config/socket';
import {
  crearContextoPrueba,
  crearIncidenciaPrueba,
  limpiarBaseDeDatos,
  type ContextoPrueba,
} from '../helpers/db';

jest.mock('../../src/config/socket', () => ({
  emitirIncidenciaNueva: jest.fn(),
  emitirCambioEstadoIncidencia: jest.fn(),
}));

const app = createApp();
let contexto: ContextoPrueba;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  contexto = await crearContextoPrueba();
});

afterAll(async () => {
  await limpiarBaseDeDatos();
  await prisma.$disconnect();
});

describe('POST /api/incidencias', () => {
  it('crea una incidencia y notifica a los usuarios autorizados', async () => {
    const respuesta = await request(app)
      .post('/api/incidencias')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`)
      .send({
        titulo: 'No hay conexion a internet',
        descripcion: 'El equipo no navega desde la manana',
        tipoRequerimiento: 'CONEXION_DE_RED',
        departamentoId: contexto.departamentoId,
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data).toMatchObject({
      titulo: 'No hay conexion a internet',
      estado: 'NUEVO',
      prioridad: 'NORMAL',
      solicitante: { id: contexto.adminId },
    });

    const notificaciones = await prisma.notificacion.findMany({
      where: { incidenciaId: respuesta.body.data.id },
    });
    expect(notificaciones).toHaveLength(1);
    expect(notificaciones[0].usuarioId).toBe(contexto.adminId);

    expect(emitirIncidenciaNueva).toHaveBeenCalledTimes(1);
    expect(emitirIncidenciaNueva).toHaveBeenCalledWith(
      contexto.adminId,
      expect.objectContaining({
        id: respuesta.body.data.id,
        notificacionId: notificaciones[0].id,
      })
    );
  });

  it('valida los campos obligatorios', async () => {
    const respuesta = await request(app)
      .post('/api/incidencias')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBe('Faltan campos obligatorios');
  });

  it('rechaza un departamento inexistente', async () => {
    const respuesta = await request(app)
      .post('/api/incidencias')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`)
      .send({
        titulo: 'Incidencia con departamento invalido',
        descripcion: 'Descripcion',
        tipoRequerimiento: 'OTROS',
        departamentoId: 999999,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBe(
      'El departamento no existe o esta inactivo'
    );
  });

  it('exige autenticacion', async () => {
    const respuesta = await request(app).post('/api/incidencias').send({
      titulo: 'Sin token',
      descripcion: 'Descripcion',
      tipoRequerimiento: 'OTROS',
    });

    expect(respuesta.status).toBe(401);
  });

  it('rechaza a un usuario sin permiso de creacion', async () => {
    const respuesta = await request(app)
      .post('/api/incidencias')
      .set('Authorization', `Bearer ${contexto.tokenLimitado}`)
      .send({
        titulo: 'Sin permiso',
        descripcion: 'Descripcion',
        tipoRequerimiento: 'OTROS',
      });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.message).toBe(
      'No tienes permisos para realizar esta operacion'
    );
  });
});

describe('GET /api/incidencias', () => {
  it('lista las incidencias con metadatos de paginacion', async () => {
    await crearIncidenciaPrueba(contexto, { titulo: 'Primera incidencia' });
    await crearIncidenciaPrueba(contexto, { titulo: 'Segunda incidencia' });

    const respuesta = await request(app)
      .get('/api/incidencias?page=1&limit=1')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.meta).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('filtra por estado', async () => {
    await crearIncidenciaPrueba(contexto, { titulo: 'Nueva' });
    await crearIncidenciaPrueba(contexto, {
      titulo: 'Completada',
      estado: 'COMPLETADO',
    });

    const respuesta = await request(app)
      .get('/api/incidencias?estado=COMPLETADO')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
    expect(respuesta.body.data[0].titulo).toBe('Completada');
  });

  it('permite listar a un usuario con permiso de lectura', async () => {
    await crearIncidenciaPrueba(contexto);

    const respuesta = await request(app)
      .get('/api/incidencias')
      .set('Authorization', `Bearer ${contexto.tokenLimitado}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toHaveLength(1);
  });
});

describe('GET /api/incidencias/:id', () => {
  it('devuelve el detalle de una incidencia', async () => {
    const incidencia = await crearIncidenciaPrueba(contexto, {
      titulo: 'Detalle de prueba',
    });

    const respuesta = await request(app)
      .get(`/api/incidencias/${incidencia.id}`)
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: incidencia.id,
      titulo: 'Detalle de prueba',
      descripcion: 'Descripcion de la incidencia de pruebas',
      actualizaciones: [],
    });
  });

  it('devuelve 404 si la incidencia no existe', async () => {
    const respuesta = await request(app)
      .get('/api/incidencias/999999')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.message).toBe('Incidencia no encontrada');
  });
});

describe('PATCH /api/incidencias/:id/estado', () => {
  it('cambia el estado y registra la fecha de resolucion', async () => {
    const incidencia = await crearIncidenciaPrueba(contexto);

    const respuesta = await request(app)
      .patch(`/api/incidencias/${incidencia.id}/estado`)
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`)
      .send({ estado: 'COMPLETADO' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.estado).toBe('COMPLETADO');
    expect(respuesta.body.data.fechaResolucion).toEqual(expect.any(String));
    expect(emitirCambioEstadoIncidencia).toHaveBeenCalledTimes(1);
    expect(emitirCambioEstadoIncidencia).toHaveBeenCalledWith(
      expect.objectContaining({
        id: incidencia.id,
        estadoAnterior: 'NUEVO',
        estado: 'COMPLETADO',
      })
    );
  });

  it('rechaza un estado invalido', async () => {
    const incidencia = await crearIncidenciaPrueba(contexto);

    const respuesta = await request(app)
      .patch(`/api/incidencias/${incidencia.id}/estado`)
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`)
      .send({ estado: 'ESTADO_INVENTADO' });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toContain('no tiene un valor valido');
  });

  it('rechaza a un usuario sin permiso de edicion', async () => {
    const incidencia = await crearIncidenciaPrueba(contexto);

    const respuesta = await request(app)
      .patch(`/api/incidencias/${incidencia.id}/estado`)
      .set('Authorization', `Bearer ${contexto.tokenLimitado}`)
      .send({ estado: 'COMPLETADO' });

    expect(respuesta.status).toBe(403);
  });
});
