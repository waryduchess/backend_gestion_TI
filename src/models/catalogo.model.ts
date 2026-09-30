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
