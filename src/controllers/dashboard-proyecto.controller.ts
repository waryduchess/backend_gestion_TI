import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { obtenerResumenProyectos } from '../services/dashboard-proyecto.service';
import { asyncHandler } from '../utils/asyncHandler';

export const obtenerResumenProyectosDashboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.usuario) {
      throw new HttpError(401, 'Autenticacion requerida');
    }

    res.status(200).json({
      success: true,
      message: 'Resumen de proyectos obtenido correctamente',
      errors: [],
      data: await obtenerResumenProyectos(req.usuario.id),
    });
  }
);
