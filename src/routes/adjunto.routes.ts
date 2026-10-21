import { Router } from 'express';
import {
  crearAdjuntoController,
  descargarAdjuntoController,
  eliminarAdjuntoController,
  listarAdjuntosController,
} from '../controllers/adjunto.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';
import { subirImagenMiddleware } from '../middlewares/upload.middleware';

const router: Router = Router();

router.use(verificarToken);
router.get('/', verificarPermiso('adjuntos:leer'), listarAdjuntosController);
router.post(
  '/',
  verificarPermiso('adjuntos:subir'),
  subirImagenMiddleware,
  crearAdjuntoController
);
router.get(
  '/:id/descarga',
  verificarPermiso('adjuntos:leer'),
  descargarAdjuntoController
);
router.delete(
  '/:id',
  verificarPermiso('adjuntos:eliminar'),
  eliminarAdjuntoController
);

export default router;
