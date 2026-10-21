import { Router } from 'express';
import {
  actualizarMiembroController,
  actualizarProyectoController,
  agregarMiembroController,
  crearProyectoController,
  eliminarMiembroController,
  eliminarProyectoController,
  listarMiembrosController,
  listarProyectosController,
  obtenerProyectoController,
} from '../controllers/proyecto.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';
import { verificarAccesoProyecto } from '../middlewares/proyecto-visibilidad.middleware';
import tareaRoutes from './proyecto-tarea.routes';
import hitoRoutes from './proyecto-hito.routes';
import horaRoutes from './proyecto-horas.routes';

const router: Router = Router();

router.use(verificarToken);

router.get('/', verificarPermiso('proyectos:leer'), listarProyectosController);
router.post('/', verificarPermiso('proyectos:crear'), crearProyectoController);
router.use('/:id/tareas', verificarPermiso('proyectos:leer'), verificarAccesoProyecto, tareaRoutes);
router.use('/:id/hitos', verificarPermiso('proyectos:leer'), verificarAccesoProyecto, hitoRoutes);
router.use('/:id/horas', verificarPermiso('proyectos:leer'), verificarAccesoProyecto, horaRoutes);
router.get(
  '/:id/miembros',
  verificarPermiso('proyectos:leer'),
  verificarAccesoProyecto,
  listarMiembrosController
);
router.post(
  '/:id/miembros',
  verificarPermiso('proyectos:editar'),
  verificarAccesoProyecto,
  agregarMiembroController
);
router.patch(
  '/:id/miembros/:usuarioId',
  verificarPermiso('proyectos:editar'),
  verificarAccesoProyecto,
  actualizarMiembroController
);
router.delete(
  '/:id/miembros/:usuarioId',
  verificarPermiso('proyectos:editar'),
  verificarAccesoProyecto,
  eliminarMiembroController
);
router.get(
  '/:id',
  verificarPermiso('proyectos:leer'),
  verificarAccesoProyecto,
  obtenerProyectoController
);
router.patch(
  '/:id',
  verificarPermiso('proyectos:editar'),
  verificarAccesoProyecto,
  actualizarProyectoController
);
router.delete(
  '/:id',
  verificarPermiso('proyectos:eliminar'),
  verificarAccesoProyecto,
  eliminarProyectoController
);

export default router;
