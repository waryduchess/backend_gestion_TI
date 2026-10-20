import { Router } from 'express';
import {
  actualizarRecordatorioController,
  completarRecordatorioController,
  crearRecordatorioController,
  eliminarRecordatorioController,
  listarRecordatoriosController,
  obtenerRecordatorioController,
} from '../controllers/recordatorio.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('recordatorios:leer'),
  listarRecordatoriosController
);
router.post(
  '/',
  verificarPermiso('recordatorios:crear'),
  crearRecordatorioController
);
router.patch(
  '/:id/completar',
  verificarPermiso('recordatorios:editar'),
  completarRecordatorioController
);
router.get(
  '/:id',
  verificarPermiso('recordatorios:leer'),
  obtenerRecordatorioController
);
router.patch(
  '/:id',
  verificarPermiso('recordatorios:editar'),
  actualizarRecordatorioController
);
router.delete(
  '/:id',
  verificarPermiso('recordatorios:eliminar'),
  eliminarRecordatorioController
);

export default router;
