import { EstadoTarea } from '../generated/prisma/client';

export interface TareaDependenciaResumen {
  id: number;
  titulo: string;
  estado: EstadoTarea;
  parentId: number | null;
}

export interface DependenciasTarea {
  dependeDe: TareaDependenciaResumen[];
  dependientes: TareaDependenciaResumen[];
}
