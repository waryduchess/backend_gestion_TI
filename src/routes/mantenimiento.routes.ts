import { Router } from 'express';
import {
  actualizarMantenimientoController,
  crearMantenimientoController,
  eliminarMantenimientoController,
  listarMantenimientosController,
  listarMantenimientosPorActivoController,
  obtenerMantenimientoController,
} from '../controllers/mantenimiento.controller';
import {
  crearEvidenciaMantenimientoController,
  descargarEvidenciaMantenimientoController,
  eliminarEvidenciaMantenimientoController,
  listarEvidenciasMantenimientoController,
} from '../controllers/mantenimiento-evidencias.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';
import { subirImagenMiddleware } from '../middlewares/upload.middleware';

const router: Router = Router();

router.use(verificarToken);

router.get(
  '/',
  verificarPermiso('mantenimiento:leer'),
  listarMantenimientosController
);
router.post(
  '/',
  verificarPermiso('mantenimiento:crear'),
  crearMantenimientoController
);
router.get(
  '/activo/:activoId',
  verificarPermiso('mantenimiento:leer'),
  listarMantenimientosPorActivoController
);
router.get(
  '/:id/evidencias',
  verificarPermiso('mantenimiento:leer'),
  verificarPermiso('adjuntos:leer'),
  listarEvidenciasMantenimientoController
);
router.post(
  '/:id/evidencias',
  verificarPermiso('mantenimiento:editar'),
  verificarPermiso('adjuntos:subir'),
  subirImagenMiddleware,
  crearEvidenciaMantenimientoController
);
router.get(
  '/:id/evidencias/:adjuntoId/descarga',
  verificarPermiso('mantenimiento:leer'),
  verificarPermiso('adjuntos:leer'),
  descargarEvidenciaMantenimientoController
);
router.delete(
  '/:id/evidencias/:adjuntoId',
  verificarPermiso('mantenimiento:editar'),
  verificarPermiso('adjuntos:eliminar'),
  eliminarEvidenciaMantenimientoController
);
router.get(
  '/:id',
  verificarPermiso('mantenimiento:leer'),
  obtenerMantenimientoController
);
router.patch(
  '/:id',
  verificarPermiso('mantenimiento:editar'),
  actualizarMantenimientoController
);
router.delete(
  '/:id',
  verificarPermiso('mantenimiento:eliminar'),
  eliminarMantenimientoController
);

export default router;
