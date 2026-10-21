import { Router } from 'express';
import { obtenerResumenDashboard } from '../controllers/dashboard.controller';
import { obtenerResumenProyectosDashboard } from '../controllers/dashboard-proyecto.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';

const router: Router = Router();

router.use(verificarToken, verificarPermiso('dashboard:leer'));
router.get('/summary', obtenerResumenDashboard);
router.get(
  '/proyectos',
  verificarPermiso('proyectos:leer'),
  obtenerResumenProyectosDashboard
);

export default router;
