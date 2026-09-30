import { Router } from 'express';
import { devolverAsignacion, listarAsignaciones } from '../controllers/asignacion.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get('/', verificarToken, verificarPermiso('activos:leer'), listarAsignaciones);
router.post(
  '/:id/devolucion',
  verificarToken,
  verificarPermiso('activos:asignar'),
  devolverAsignacion
);

export default router;
