import { Router } from 'express';
import { crearActivo, listarActivos, obtenerActivo, actualizarActivo, cambiarEstadoActivo } from '../controllers/activo.controller';

const router: Router = Router();

router.get('/', listarActivos);
router.post('/', crearActivo);
router.get('/:id', obtenerActivo);
router.patch('/:id', actualizarActivo);
router.patch('/:id/estado', cambiarEstadoActivo);

export default router;
