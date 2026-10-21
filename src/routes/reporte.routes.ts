import { Router } from 'express';
import {
  crearGeneracionReporteController,
  descargarGeneracionController,
  descargarReporteController,
  listarGeneracionesController,
  listarReportesController,
  obtenerGeneracionController,
  obtenerReporteController,
} from '../controllers/reporte.controller';
import {
  actualizarProgramacionController,
  crearProgramacionController,
  desactivarProgramacionController,
  listarProgramacionesController,
  obtenerProgramacionController,
} from '../controllers/reporte-programacion.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken);
router.get('/', verificarPermiso('reportes:leer'), listarReportesController);
router.get(
  '/programaciones',
  verificarPermiso('reportes:programar'),
  listarProgramacionesController
);
router.post(
  '/programaciones',
  verificarPermiso('reportes:programar'),
  crearProgramacionController
);
router.get(
  '/programaciones/:id',
  verificarPermiso('reportes:programar'),
  obtenerProgramacionController
);
router.patch(
  '/programaciones/:id',
  verificarPermiso('reportes:programar'),
  actualizarProgramacionController
);
router.delete(
  '/programaciones/:id',
  verificarPermiso('reportes:programar'),
  desactivarProgramacionController
);
router.get(
  '/generaciones',
  verificarPermiso('reportes:leer'),
  listarGeneracionesController
);
router.get(
  '/generaciones/:id',
  verificarPermiso('reportes:leer'),
  obtenerGeneracionController
);
router.get(
  '/generaciones/:id/descarga',
  verificarPermiso('reportes:leer'),
  descargarGeneracionController
);
router.post(
  '/:codigo/generaciones',
  verificarPermiso('reportes:leer'),
  crearGeneracionReporteController
);
router.get(
  '/:codigo/descargar',
  verificarPermiso('reportes:leer'),
  descargarReporteController
);
router.get('/:codigo', verificarPermiso('reportes:leer'), obtenerReporteController);

export default router;
