import { Router } from 'express';
import { crearActivo, listarActivos, obtenerActivo, actualizarActivo, cambiarEstadoActivo, asignarActivo, eliminarActivo } from '../controllers/activo.controller';

const router: Router = Router();

router.get('/', listarActivos);
router.post('/', crearActivo);
router.get('/:id', obtenerActivo);
router.patch('/:id', actualizarActivo);
router.patch('/:id/estado', cambiarEstadoActivo);
router.post('/:id/asignaciones', asignarActivo);
router.delete('/:id', eliminarActivo);

export default router;
