import { Router } from 'express';
import { listarCatalogos } from '../controllers/catalogo.controller';

const router: Router = Router();

router.get('/', listarCatalogos);

export default router;
