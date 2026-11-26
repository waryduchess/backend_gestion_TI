import { Router } from 'express';
import {
  confirmarRestablecimiento,
  login,
  obtenerPerfilPropio,
  solicitarRecuperacion,
} from '../controllers/auth.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.post('/login', login);
router.post('/recuperar', solicitarRecuperacion);
router.post('/restablecer', confirmarRestablecimiento);
router.get('/me', verificarToken, obtenerPerfilPropio);

export default router;
