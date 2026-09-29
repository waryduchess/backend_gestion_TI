import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoTexto } from '../utils/validacion';
import { devolver } from '../services/activo.service';
import { ActivoDetalle } from '../models/activo.model';

export const devolverAsignacion = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const textoId = comoTexto(req.params.id);

    if (!/^\d+$/.test(textoId)) {
      throw new HttpError(400, 'El parametro "id" debe ser un numero entero', [
        { campo: 'id', valor: textoId },
      ]);
    }

    const activo: ActivoDetalle = await devolver(Number(textoId));

    res.status(200).json({
      success: true,
      message: 'Asignacion devuelta correctamente',
      errors: [],
      data: activo,
    });
  }
);
