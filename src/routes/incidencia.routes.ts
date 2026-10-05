import { Router } from 'express';
import {
  listarIncidencias,
  obtenerIncidencia,
} from '../controllers/incidencia.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.get(
  '/',
  verificarToken,
  verificarPermiso('incidencias:leer'),
  listarIncidencias
);

router.get(
  '/:id',
  verificarToken,
  verificarPermiso('incidencias:leer'),
  obtenerIncidencia
);

export default router;
