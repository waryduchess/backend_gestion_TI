import { Router } from 'express';
import {
  listarAuditoriaController,
  obtenerAuditoriaController,
} from '../controllers/auditoria.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken);
router.get(
  '/',
  verificarPermiso('auditoria:leer'),
  listarAuditoriaController
);
router.get(
  '/:id',
  verificarPermiso('auditoria:leer'),
  obtenerAuditoriaController
);

export default router;
