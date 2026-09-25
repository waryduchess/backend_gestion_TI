import { Router } from 'express';
import { listarIncidencias } from '../controllers/incidencia.controller';

const router: Router = Router();

router.get('/', listarIncidencias);

export default router;
