import { Router } from 'express';
import { devolverAsignacion, listarAsignaciones } from '../controllers/asignacion.controller';

const router: Router = Router();

router.get('/', listarAsignaciones);
router.post('/:id/devolucion', devolverAsignacion);

export default router;
