import { Router } from 'express';
import { listarActivos, obtenerActivo } from '../controllers/activo.controller';

const router: Router = Router();

router.get('/', listarActivos);
router.get('/:id', obtenerActivo);

export default router;
