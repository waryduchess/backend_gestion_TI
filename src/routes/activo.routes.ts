import { Router } from 'express';
import { crearActivo, listarActivos, obtenerActivo, actualizarActivo } from '../controllers/activo.controller';

const router: Router = Router();

router.get('/', listarActivos);
router.post('/', crearActivo);
router.get('/:id', obtenerActivo);
router.patch('/:id', actualizarActivo);

export default router;
