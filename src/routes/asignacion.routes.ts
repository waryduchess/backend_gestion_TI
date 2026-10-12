import { Router } from 'express';
import {
  devolverAsignacion,
  editarAsignacion,
  eliminarAsignacion,
  listarAsignaciones,
} from '../controllers/asignacion.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get('/', verificarToken, verificarPermiso('activos:leer'), listarAsignaciones);
router.post(
  '/:id/devolucion',
  verificarToken,
  verificarPermiso('activos:asignar'),
  devolverAsignacion
);
router.patch(
  '/:id',
  verificarToken,
  verificarPermiso('activos:asignar'),
  editarAsignacion
);
router.delete(
  '/:id',
  verificarToken,
  verificarPermiso('activos:asignar'),
  eliminarAsignacion
);

export default router;
