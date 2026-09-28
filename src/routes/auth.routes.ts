import { Router } from 'express';
import { login, obtenerPerfilPropio } from '../controllers/auth.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.post('/login', login);
router.get('/me', verificarToken, obtenerPerfilPropio);

export default router;
