import { Router } from 'express';
import {
  actualizarHitoController,
  crearHitoController,
  eliminarHitoController,
  listarHitosController,
  obtenerHitoController,
} from '../controllers/proyecto-hito.controller';
import { verificarPermiso } from '../middlewares/auth.middleware';

const router: Router = Router({ mergeParams: true });

router.get('/', verificarPermiso('proyectos:leer'), listarHitosController);
router.post('/', verificarPermiso('proyectos:editar'), crearHitoController);
router.get(
  '/:hitoId',
  verificarPermiso('proyectos:leer'),
  obtenerHitoController
);
router.patch(
  '/:hitoId',
  verificarPermiso('proyectos:editar'),
  actualizarHitoController
);
router.delete(
  '/:hitoId',
  verificarPermiso('proyectos:editar'),
  eliminarHitoController
);

export default router;
