import { Router } from 'express';
import {
  actualizarTareaController,
  crearTareaController,
  eliminarTareaController,
  listarTareasController,
  obtenerTareaController,
} from '../controllers/proyecto-tarea.controller';
import {
  agregarDependenciaController,
  eliminarDependenciaController,
  listarDependenciasController,
} from '../controllers/proyecto-dependencia.controller';
import { verificarPermiso } from '../middlewares/auth.middleware';

const router: Router = Router({ mergeParams: true });

router.get('/', verificarPermiso('proyectos:leer'), listarTareasController);
router.post('/', verificarPermiso('proyectos:editar'), crearTareaController);
router.get(
  '/:tareaId/dependencias',
  verificarPermiso('proyectos:leer'),
  listarDependenciasController
);
router.post(
  '/:tareaId/dependencias',
  verificarPermiso('proyectos:editar'),
  agregarDependenciaController
);
router.delete(
  '/:tareaId/dependencias/:dependeDeId',
  verificarPermiso('proyectos:editar'),
  eliminarDependenciaController
);
router.get(
  '/:tareaId',
  verificarPermiso('proyectos:leer'),
  obtenerTareaController
);
router.patch(
  '/:tareaId',
  verificarPermiso('proyectos:editar'),
  actualizarTareaController
);
router.delete(
  '/:tareaId',
  verificarPermiso('proyectos:editar'),
  eliminarTareaController
);

export default router;
