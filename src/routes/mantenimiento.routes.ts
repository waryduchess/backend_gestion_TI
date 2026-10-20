import { Router } from 'express';
import {
  actualizarMantenimientoController,
  crearMantenimientoController,
  eliminarMantenimientoController,
  listarMantenimientosController,
  listarMantenimientosPorActivoController,
  obtenerMantenimientoController,
} from '../controllers/mantenimiento.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('mantenimiento:leer'),
  listarMantenimientosController
);
router.post(
  '/',
  verificarPermiso('mantenimiento:crear'),
  crearMantenimientoController
);
router.get(
  '/activo/:activoId',
  verificarPermiso('mantenimiento:leer'),
  listarMantenimientosPorActivoController
);
router.get(
  '/:id',
  verificarPermiso('mantenimiento:leer'),
  obtenerMantenimientoController
);
router.patch(
  '/:id',
  verificarPermiso('mantenimiento:editar'),
  actualizarMantenimientoController
);
router.delete(
  '/:id',
  verificarPermiso('mantenimiento:eliminar'),
  eliminarMantenimientoController
);

export default router;
