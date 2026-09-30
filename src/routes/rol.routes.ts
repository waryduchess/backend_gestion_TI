import { Router } from 'express';
import {
  actualizar,
  crear,
  eliminar,
  listar,
  obtener,
} from '../controllers/rol.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();
const administrarRoles = [verificarToken, verificarPermiso('roles:administrar')];

router.get('/', administrarRoles, listar);
router.post('/', administrarRoles, crear);
router.get('/:id', administrarRoles, obtener);
router.patch('/:id', administrarRoles, actualizar);
router.delete('/:id', administrarRoles, eliminar);

export default router;
