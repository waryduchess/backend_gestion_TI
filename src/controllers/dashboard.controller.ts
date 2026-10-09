import { Request, Response } from 'express';
import { HttpError } from '../middlewares/error.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { comoTexto } from '../utils/validacion';
import { obtenerResumen } from '../services/dashboard.service';
import { SucursalDashboard } from '../models/dashboard.model';

const SUCURSALES_VALIDAS = ['CANCUN', 'PLAYA'] as const;

export const obtenerResumenDashboard = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const texto = comoTexto(req.query.sucursal).toUpperCase();

    let sucursal: SucursalDashboard | null = null;

    if (texto !== '') {
      if (!(SUCURSALES_VALIDAS as readonly string[]).includes(texto)) {
        throw new HttpError(
          400,
          'El parametro "sucursal" debe ser "CANCUN" o "PLAYA"',
          [{ campo: 'sucursal', valor: texto }]
        );
      }
      sucursal = texto as SucursalDashboard;
    }

    const data = await obtenerResumen(sucursal);

    res.status(200).json({
      success: true,
      message: 'Resumen del dashboard obtenido correctamente',
      errors: [],
      data,
    });
  }
);
