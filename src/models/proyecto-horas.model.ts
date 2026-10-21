import { MetadatosPaginacion, UsuarioResumen } from './comun.model';

export interface TareaHorasResumen {
  id: number;
  titulo: string;
}

export interface RegistroHorasResumen {
  id: number;
  proyectoId: number;
  tareaId: number | null;
  tarea: TareaHorasResumen | null;
  usuarioId: string;
  usuario: UsuarioResumen;
  fecha: Date;
  horas: number;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatosCreacionHoras {
  tareaId: number | null;
  usuarioId: string;
  fecha: Date;
  horas: number;
  descripcion: string | null;
}

export interface DatosEdicionHoras {
  tareaId?: number | null;
  usuarioId?: string;
  fecha?: Date;
  horas?: number;
  descripcion?: string | null;
}

export interface ParametrosListadoHoras {
  page: number;
  limit: number;
  tareaId?: number;
  usuarioId?: string;
  desde?: Date;
  hasta?: Date;
}

export interface ResultadoListadoHoras {
  registros: RegistroHorasResumen[];
  meta: MetadatosPaginacion;
}
