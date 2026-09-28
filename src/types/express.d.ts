import { UsuarioAuth } from '../models/auth.model';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAuth;
    }
  }
}

export {};
