import { Router } from 'express';
import {
  cambiarEstadoIncidencia,
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

router.patch(
  '/:id/estado',
  verificarToken,
  verificarPermiso('incidencias:editar'),
  cambiarEstadoIncidencia
);

export default router;
