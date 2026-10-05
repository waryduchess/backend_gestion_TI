export interface CatalogoItem {
  id: number;
  nombre: string;
}

export interface Catalogos {
  departamentos: CatalogoItem[];
  ubicaciones: CatalogoItem[];
  puestos: CatalogoItem[];
  tiposUsuario: CatalogoItem[];
  roles: CatalogoItem[];
}

export type TipoCatalogo =
  | 'departamento'
  | 'ubicacion'
  | 'puesto'
  | 'tipoUsuario';

export interface CatalogoAdministrable extends CatalogoItem {
  activo: boolean;
}
