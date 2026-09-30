import 'dotenv/config';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import authRoutes from './routes/auth.routes';
import activoRoutes from './routes/activo.routes';
import asignacionRoutes from './routes/asignacion.routes';
import incidenciaRoutes from './routes/incidencia.routes';
import usuarioRoutes from './routes/usuario.routes';
import docsRoutes from './docs/docs.routes';

const app: Application = express();

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
app.use('/api/docs', docsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

export default app;
