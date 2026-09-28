export interface CredencialesLogin {
  email: string;
  password: string;
}

export interface UsuarioAuth {
  id: string;
  nombre: string;
  email: string | null;
}

export interface UsuarioPerfil extends UsuarioAuth {
  activo: boolean;
  rol: string | null;
}

export interface RespuestaLogin {
  token: string;
  tokenTipo: 'Bearer';
  expiraEn: string;
  usuario: UsuarioAuth;
}
