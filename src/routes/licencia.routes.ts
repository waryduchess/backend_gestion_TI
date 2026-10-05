import { Router } from 'express';
import {
  actualizarLicenciaController,
  crearLicenciaController,
  eliminarLicenciaController,
  listarLicenciasController,
  obtenerLicenciaController,
} from '../controllers/licencia.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken, verificarPermiso('licencias:administrar'));
router.get('/', listarLicenciasController);
router.post('/', crearLicenciaController);
router.get('/:id', obtenerLicenciaController);
router.patch('/:id', actualizarLicenciaController);
router.delete('/:id', eliminarLicenciaController);

export default router;
