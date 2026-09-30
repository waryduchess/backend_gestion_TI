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

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.get('/:id', obtenerUsuario);
router.patch('/:id', actualizarUsuario);
router.patch(
  '/:id/rol',
  verificarToken,
  verificarPermiso('roles:administrar'),
  asignarRolUsuario
);
router.patch('/:id/password', cambiarPasswordUsuario);
router.delete('/:id', eliminarUsuario);

export default router;
