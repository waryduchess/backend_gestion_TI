import { Router } from 'express';
import {
  actualizarSecretoController,
  crearSecretoController,
  desactivarSecretoController,
  listarAuditoriaSecretoController,
  listarSecretosController,
  obtenerPasswordSecretoController,
  obtenerSecretoController,
} from '../controllers/secreto.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken);
router.get('/', verificarPermiso('secretos:leer'), listarSecretosController);
router.post(
  '/',
  verificarPermiso('secretos:administrar'),
  crearSecretoController
);
router.get(
  '/:id/password',
  verificarPermiso('secretos:revelar'),
  obtenerPasswordSecretoController
);
router.get(
  '/:id/auditoria',
  verificarPermiso('secretos:administrar'),
  listarAuditoriaSecretoController
);
router.get('/:id', verificarPermiso('secretos:leer'), obtenerSecretoController);
router.patch(
  '/:id',
  verificarPermiso('secretos:administrar'),
  actualizarSecretoController
);
router.delete(
  '/:id',
  verificarPermiso('secretos:administrar'),
  desactivarSecretoController
);

export default router;
