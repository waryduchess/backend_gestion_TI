import { Router } from 'express';
import { crearActivo, listarActivos, obtenerActivo } from '../controllers/activo.controller';

const router: Router = Router();

router.get('/', listarActivos);
router.post('/', crearActivo);
router.get('/:id', obtenerActivo);

export default router;
