import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import { HttpError } from './error.middleware';
import {
  esMimeImagenPermitido,
  TAMANO_MAXIMO_IMAGEN,
} from '../utils/archivo';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: TAMANO_MAXIMO_IMAGEN,
    files: 1,
  },
  fileFilter: (_req, file, callback): void => {
    if (!esMimeImagenPermitido(file.mimetype)) {
      callback(
        new HttpError(
          400,
          'El archivo debe ser una imagen PNG, JPEG o WebP',
          [{ campo: 'archivo', valor: file.mimetype }]
        )
      );
      return;
    }
    callback(null, true);
  },
});

export const subirImagenMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  upload.single('archivo')(req, res, (error: unknown): void => {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new HttpError(
            400,
            `La imagen no puede superar ${TAMANO_MAXIMO_IMAGEN} bytes`,
            [{ campo: 'archivo', maximo: TAMANO_MAXIMO_IMAGEN }]
          )
        );
        return;
      }
      next(
        new HttpError(400, 'No se pudo procesar el archivo adjunto', [
          { campo: 'archivo', codigo: error.code },
        ])
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    next();
  });
};
