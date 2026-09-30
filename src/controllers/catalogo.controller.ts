import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { obtenerCatalogos } from '../services/catalogo.service';

export const listarCatalogos = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const catalogos = await obtenerCatalogos();

    res.status(200).json({
      success: true,
      message: 'Catalogos obtenidos correctamente',
      errors: [],
      data: catalogos,
    });
  }
);
