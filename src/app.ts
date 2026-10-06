import 'dotenv/config';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import { createServer } from 'node:http';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import activoRoutes from './routes/activo.routes';
import asignacionRoutes from './routes/asignacion.routes';
import incidenciaRoutes from './routes/incidencia.routes';
import usuarioRoutes from './routes/usuario.routes';
import catalogoRoutes from './routes/catalogo.routes';
import { crearRutasCatalogoAdministrable } from './routes/catalogo-admin.routes';
import rolRoutes from './routes/rol.routes';
import docsRoutes from './docs/docs.routes';
import licenciaRoutes from './routes/licencia.routes';
import notificacionRoutes from './routes/notificacion.routes';
import secretoRoutes from './routes/secreto.routes';
import { iniciarJobAlertasLicencias } from './jobs/licencias.job';
import { inicializarSocketIo } from './config/socket';

const app: Application = express();
const servidor = createServer(app);
inicializarSocketIo(servidor);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    success: true,
    message: 'API operativa',
    errors: [],
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/activos', activoRoutes);
app.use('/api/asignaciones', asignacionRoutes);
app.use('/api/incidencias', incidenciaRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use(
  '/api/departamentos',
  crearRutasCatalogoAdministrable('departamento')
);
app.use('/api/ubicaciones', crearRutasCatalogoAdministrable('ubicacion'));
app.use('/api/puestos', crearRutasCatalogoAdministrable('puesto'));
app.use(
  '/api/tipos-usuario',
  crearRutasCatalogoAdministrable('tipoUsuario')
);
app.use('/api/roles', rolRoutes);
app.use('/api/licencias', licenciaRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/secretos', secretoRoutes);
app.use('/api/docs', docsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

servidor.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  iniciarJobAlertasLicencias();
});

export default app;
