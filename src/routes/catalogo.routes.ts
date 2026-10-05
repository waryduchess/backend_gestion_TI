import { Router } from 'express';
import { listarCatalogos } from '../controllers/catalogo.controller';
import { verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get('/', verificarToken, listarCatalogos);

export default router;
