export const LIMITE_FILAS_IMPORTACION_SECRETOS = 500;

export const COLUMNAS_IMPORTACION_SECRETOS = {
  nombre: 'Nombre',
  tipo: 'Tipo',
  usuario: 'Usuario',
  password: 'Contraseña',
  comentario: 'Comentario',
} as const;

export type FilaImportacionSecretoCruda = Record<string, unknown>;

export interface DatosFilaImportadaSecreto {
  tipo: string | null;
  nombre: string;
  usuario: string | null;
  comentario: string | null;
}

export interface ResultadoFilaImportacionSecreto {
  fila: number;
  valido: boolean;
  errores: string[];
  advertencias: string[];
  datos: DatosFilaImportadaSecreto | null;
}

export interface ResumenValidacionImportacionSecreto {
  total: number;
  validas: number;
  invalidas: number;
}

export interface ResultadoValidacionImportacionSecreto {
  resumen: ResumenValidacionImportacionSecreto;
  filas: ResultadoFilaImportacionSecreto[];
}

export interface FilaConfirmacionImportacionSecreto {
  fila: number;
  creado: boolean;
  secretoId: number | null;
  errores: string[];
  advertencias: string[];
}

export interface ResumenConfirmacionImportacionSecreto {
  total: number;
  creadas: number;
  rechazadas: number;
}

export interface ResultadoConfirmacionImportacionSecreto {
  resumen: ResumenConfirmacionImportacionSecreto;
  filas: FilaConfirmacionImportacionSecreto[];
}
