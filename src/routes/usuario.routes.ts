import { Router } from 'express';
import {
  cambiarPasswordUsuario,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
  listarUsuarios,
  obtenerUsuario,
} from '../controllers/usuario.controller';

const router: Router = Router();

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.get('/:id', obtenerUsuario);
router.patch('/:id', actualizarUsuario);
router.patch('/:id/password', cambiarPasswordUsuario);
router.delete('/:id', eliminarUsuario);

export default router;
