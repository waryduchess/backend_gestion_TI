import { Router } from 'express';
import {
  actualizarRegistroHorasController,
  crearRegistroHorasController,
  eliminarRegistroHorasController,
  listarHorasController,
  obtenerRegistroHorasController,
} from '../controllers/proyecto-horas.controller';
import { verificarPermiso } from '../middlewares/auth.middleware';

const router: Router = Router({ mergeParams: true });

router.get('/', verificarPermiso('proyectos:leer'), listarHorasController);
router.post('/', verificarPermiso('proyectos:editar'), crearRegistroHorasController);
router.get(
  '/:registroId',
  verificarPermiso('proyectos:leer'),
  obtenerRegistroHorasController
);
router.patch(
  '/:registroId',
  verificarPermiso('proyectos:editar'),
  actualizarRegistroHorasController
);
router.delete(
  '/:registroId',
  verificarPermiso('proyectos:editar'),
  eliminarRegistroHorasController
);

export default router;
