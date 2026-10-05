import { Router } from 'express';
import { crearControladorCatalogoAdministrable } from '../controllers/catalogo-admin.controller';
import { verificarPermiso, verificarToken } from '../middlewares/auth.middleware';
import { TipoCatalogo } from '../models/catalogo.model';

export const crearRutasCatalogoAdministrable = (
  tipo: TipoCatalogo
): Router => {
  const router: Router = Router();
  const controlador = crearControladorCatalogoAdministrable(tipo);

  router.use(verificarToken, verificarPermiso('catalogos:administrar'));
  router.get('/', controlador.listar);
  router.post('/', controlador.crear);
  router.get('/:id', controlador.obtener);
  router.patch('/:id', controlador.actualizar);
  router.delete('/:id', controlador.eliminar);

  return router;
};
