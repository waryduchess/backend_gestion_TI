import { Router } from 'express';
import {
  crearIncidencia,
  listarIncidencias,
  obtenerIncidencia,
} from '../controllers/incidencia.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.post(
  '/',
  verificarToken,
  verificarPermiso('incidencias:crear'),
  crearIncidencia
);

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
