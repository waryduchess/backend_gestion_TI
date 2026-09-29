import { Router } from 'express';
import { devolverAsignacion } from '../controllers/asignacion.controller';

const router: Router = Router();

router.post('/:id/devolucion', devolverAsignacion);

export default router;
