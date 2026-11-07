import request from 'supertest';
import { createApp } from '../../src/app.factory';
import { prisma } from '../../src/config/prisma';
import {
  PASSWORD_PRUEBA,
  crearContextoPrueba,
  limpiarBaseDeDatos,
  type ContextoPrueba,
} from '../helpers/db';

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

describe('GET /health', () => {
  it('responde que la API esta operativa', async () => {
    const respuesta = await request(app).get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      success: true,
      message: 'API operativa',
      errors: [],
    });
  });
});

describe('POST /api/auth/login', () => {
  it('inicia sesion con credenciales validas', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({
      email: contexto.adminEmail,
      password: PASSWORD_PRUEBA,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data).toMatchObject({
      tokenTipo: 'Bearer',
      expiraEn: '1h',
      usuario: {
        id: contexto.adminId,
        email: contexto.adminEmail,
      },
    });
    expect(respuesta.body.data.token).toEqual(expect.any(String));
  });

  it('rechaza una contrasena incorrecta', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({
      email: contexto.adminEmail,
      password: 'contrasena-incorrecta',
    });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body).toMatchObject({
      success: false,
      message: 'Credenciales invalidas',
    });
  });

  it('rechaza un usuario inexistente', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({
      email: 'no-existe@gestion-ti.local',
      password: PASSWORD_PRUEBA,
    });

    expect(respuesta.status).toBe(401);
  });

  it('valida los campos obligatorios', async () => {
    const respuesta = await request(app).post('/api/auth/login').send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.message).toBe('Faltan campos obligatorios');
    expect(respuesta.body.errors).toHaveLength(2);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el perfil del usuario autenticado', async () => {
    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${contexto.tokenAdmin}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      id: contexto.adminId,
      email: contexto.adminEmail,
      activo: true,
      rol: 'ROL_PRUEBAS_ADMIN',
    });
  });

  it('exige un token de acceso', async () => {
    const respuesta = await request(app).get('/api/auth/me');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('Token de acceso no proporcionado');
  });

  it('rechaza un token invalido', async () => {
    const respuesta = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-invalido');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.message).toBe('Token de acceso invalido o expirado');
  });
});
