import { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown[];

  constructor(statusCode: number, message: string, errors: unknown[] = []) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    errors: [],
  });
};

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof HttpError ? err.statusCode : 500;
  const errors = err instanceof HttpError ? err.errors : [];

  if (statusCode >= 500) {
    console.error('[ERROR]', err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Error interno del servidor',
    errors,
  });
};
