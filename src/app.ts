import 'dotenv/config';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API operativa',
    errors: [],
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

export default app;
