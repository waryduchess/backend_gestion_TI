import { Router } from 'express';
import {
  cambiarPasswordUsuario,
  crearUsuario,
  actualizarUsuario,
  asignarRolUsuario,
  eliminarUsuario,
  listarUsuarios,
  obtenerUsuario,
} from '../controllers/usuario.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();
router.use(verificarToken);

router.get('/', verificarPermiso('usuarios:administrar'), listarUsuarios);
router.post('/', verificarPermiso('usuarios:administrar'), crearUsuario);
router.get('/:id', verificarPermiso('usuarios:administrar'), obtenerUsuario);
router.patch('/:id', verificarPermiso('usuarios:administrar'), actualizarUsuario);
router.patch(
  '/:id/rol',
  verificarPermiso('roles:administrar'),
  asignarRolUsuario
);
router.patch(
  '/:id/password',
  verificarPermiso('usuarios:administrar'),
  cambiarPasswordUsuario
);
router.delete('/:id', verificarPermiso('usuarios:administrar'), eliminarUsuario);

export default router;
