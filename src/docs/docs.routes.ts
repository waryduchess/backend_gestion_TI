import fs from 'node:fs';
import path from 'node:path';
import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const router: Router = Router();

const RUTA_SPEC = path.join(__dirname, 'openapi.yaml');

const opciones: swaggerUi.SwaggerUiOptions = {
  customSiteTitle: 'API Sistema de Gestion TI',
  swaggerOptions: {
    url: '/api/docs/openapi.yaml',
    docExpansion: 'list',
    persistAuthorization: true,
  },
};

router.use(swaggerUi.serve);

router.get('/openapi.yaml', (_req: Request, res: Response): void => {
  res.type('application/yaml').send(fs.readFileSync(RUTA_SPEC, 'utf8'));
});

router.use(swaggerUi.setup(undefined, opciones));

export default router;
