import { Router } from 'express';
import {
  actualizarLicenciaController,
  crearLicenciaController,
  eliminarLicenciaController,
  eliminarLicenciaFisicaController,
  listarLicenciasController,
  obtenerLicenciaController,
} from '../controllers/licencia.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();
const administrar = verificarPermiso('licencias:administrar');

router.use(verificarToken);
router.get('/', administrar, listarLicenciasController);
router.post('/', administrar, crearLicenciaController);
router.delete(
  '/:id/hard',
  verificarPermiso('licencias:eliminar'),
  eliminarLicenciaFisicaController
);
router.get('/:id', administrar, obtenerLicenciaController);
router.patch('/:id', administrar, actualizarLicenciaController);
router.delete('/:id', administrar, eliminarLicenciaController);

export default router;
