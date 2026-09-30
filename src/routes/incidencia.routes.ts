import { Router } from 'express';
import { listarIncidencias } from '../controllers/incidencia.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get(
  '/',
  verificarToken,
  verificarPermiso('incidencias:leer'),
  listarIncidencias
);

export default router;
