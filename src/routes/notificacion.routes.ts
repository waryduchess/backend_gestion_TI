import { Router } from 'express';
import {
  listarNotificacionesController,
  marcarNotificacionLeidaController,
  marcarTodasLeidasController,
} from '../controllers/notificacion.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken, verificarPermiso('notificaciones:leer'));
router.get('/', listarNotificacionesController);
router.patch('/leer-todas', marcarTodasLeidasController);
router.patch('/:id/leer', marcarNotificacionLeidaController);

export default router;
