import { Router } from 'express';
import { crearActivo, listarActivos, obtenerActivo, actualizarActivo, cambiarEstadoActivo, asignarActivo, eliminarActivo } from '../controllers/activo.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get('/', verificarToken, verificarPermiso('activos:leer'), listarActivos);
router.post('/', verificarToken, verificarPermiso('activos:crear'), crearActivo);
router.get('/:id', verificarToken, verificarPermiso('activos:leer'), obtenerActivo);
router.patch('/:id', verificarToken, verificarPermiso('activos:editar'), actualizarActivo);
router.patch('/:id/estado', verificarToken, verificarPermiso('activos:estado'), cambiarEstadoActivo);
router.post('/:id/asignaciones', verificarToken, verificarPermiso('activos:asignar'), asignarActivo);
router.delete('/:id', verificarToken, verificarPermiso('activos:eliminar'), eliminarActivo);

export default router;
