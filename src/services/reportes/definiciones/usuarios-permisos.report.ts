import { Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import { HttpError } from '../../../middlewares/error.middleware';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import { Permiso } from '../../../models/rol.model';
import {
  calcularPermisosEfectivos,
  normalizarPermisos,
} from '../../../utils/permisos';
import { comoEntero, validarOpcion } from '../../../utils/validacion';

const MAX_FILAS = 10000;

const textoOpcional = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
};

const validarFiltros = (
  query: Record<string, unknown>
): Record<string, unknown> => {
  const activoTexto = validarOpcion(query.activo, 'activo', ['true', 'false']);
  const activo = activoTexto === undefined ? true : activoTexto === 'true';

  const leerId = (campo: string): number | undefined => {
    const valor = comoEntero(query[campo], campo, 0);
    if (valor < 0) {
      throw new HttpError(400, `El parámetro "${campo}" debe ser positivo`, [
        { campo, valor: String(valor) },
      ]);
    }
    return valor > 0 ? valor : undefined;
  };

  return {
    activo,
    rolId: leerId('rolId'),
    departamentoId: leerId('departamentoId'),
    ubicacionId: leerId('ubicacionId'),
    puestoId: leerId('puestoId'),
    tipoUsuarioId: leerId('tipoUsuarioId'),
    q: textoOpcional(query.q),
  };
};

const cargarUsuarios = async (
  filtros: Record<string, unknown>
): Promise<ReporteDocumento> => {
  const activo = filtros.activo as boolean;
  const rolId = filtros.rolId as number | undefined;
  const departamentoId = filtros.departamentoId as number | undefined;
  const ubicacionId = filtros.ubicacionId as number | undefined;
  const puestoId = filtros.puestoId as number | undefined;
  const tipoUsuarioId = filtros.tipoUsuarioId as number | undefined;
  const q = filtros.q as string | undefined;

  const where: Prisma.UsuarioWhereInput = {
    activo,
    ...(rolId ? { rolId } : {}),
    ...(departamentoId ? { departamentoId } : {}),
    ...(ubicacionId ? { ubicacionId } : {}),
    ...(puestoId ? { puestoId } : {}),
    ...(tipoUsuarioId ? { tipoUsuarioId } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q } },
            { nombre: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.usuario.findMany({
      where,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        nombre: true,
        email: true,
        activo: true,
        fechaInicio: true,
        fechaFin: true,
        passwordHash: true,
        permisosExtra: true,
        permisosRevocados: true,
        departamento: { select: { id: true, nombre: true } },
        ubicacion: { select: { id: true, nombre: true } },
        puesto: { select: { id: true, nombre: true } },
        tipoUsuario: { select: { id: true, nombre: true } },
        rol: { select: { id: true, nombre: true, activo: true, permisos: true } },
      },
    }),
    prisma.usuario.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  const resumenRol = new Map<string, number>();
  let activos = 0;
  let inactivos = 0;
  let conAcceso = 0;
  let conOverrides = 0;

  const detalle = filas.map((fila) => {
    let permisosRol: Permiso[] = [];
    let permisosExtra: Permiso[] = [];
    let permisosRevocados: Permiso[] = [];
    let permisosEfectivos: Permiso[] = [];

    try {
      permisosRol = normalizarPermisos(
        fila.rol?.permisos ?? [],
        `Rol del usuario ${fila.id}`
      );
      permisosExtra = normalizarPermisos(
        fila.permisosExtra ?? [],
        `permisosExtra del usuario ${fila.id}`
      );
      permisosRevocados = normalizarPermisos(
        fila.permisosRevocados ?? [],
        `permisosRevocados del usuario ${fila.id}`
      );
      permisosEfectivos = calcularPermisosEfectivos(
        fila.rol?.activo ? permisosRol : [],
        permisosExtra,
        permisosRevocados
      );
    } catch {
      permisosEfectivos = [];
    }

    if (fila.activo) activos += 1;
    else inactivos += 1;
    if (fila.passwordHash !== null) conAcceso += 1;
    if (permisosExtra.length > 0 || permisosRevocados.length > 0) {
      conOverrides += 1;
    }

    const nombreRol = fila.rol?.nombre ?? 'Sin rol';
    resumenRol.set(nombreRol, (resumenRol.get(nombreRol) ?? 0) + 1);

    return {
      id: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      activo: fila.activo,
      fechaInicio: fila.fechaInicio,
      fechaFin: fila.fechaFin,
      acceso: fila.passwordHash !== null,
      rol: nombreRol,
      rolActivo: fila.rol?.activo ?? false,
      departamento: fila.departamento?.nombre ?? null,
      ubicacion: fila.ubicacion?.nombre ?? null,
      puesto: fila.puesto?.nombre ?? null,
      tipoUsuario: fila.tipoUsuario?.nombre ?? null,
      permisosExtra: permisosExtra.join(', '),
      permisosRevocados: permisosRevocados.join(', '),
      permisosEfectivos: permisosEfectivos.join(', '),
    };
  });

  return {
    titulo: 'Reporte de usuarios, roles y permisos',
    subtitulo: `Total de registros: ${total}`,
    generadoEn: new Date(),
    generadoPor: 'Sistema',
    metadatos: {
      Activos: String(activos),
      Inactivos: String(inactivos),
      'Con acceso al sistema': String(conAcceso),
      'Con permisos extra/revocados': String(conOverrides),
      'Roles distintos': String(resumenRol.size),
      Búsqueda: q ?? 'Sin búsqueda',
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Resumen',
        columnas: [
          { clave: 'total', encabezado: 'Total', ancho: 12 },
          { clave: 'activos', encabezado: 'Activos', ancho: 12 },
          { clave: 'inactivos', encabezado: 'Inactivos', ancho: 12 },
          { clave: 'conAcceso', encabezado: 'Con acceso', ancho: 14 },
          { clave: 'conOverrides', encabezado: 'Con overrides', ancho: 16 },
          { clave: 'roles', encabezado: 'Roles distintos', ancho: 16 },
        ],
        filas: [
          {
            total,
            activos,
            inactivos,
            conAcceso,
            conOverrides,
            roles: resumenRol.size,
          },
        ],
      },
      {
        nombre: 'Resumen por rol',
        columnas: [
          { clave: 'rol', encabezado: 'Rol', ancho: 30 },
          { clave: 'cantidad', encabezado: 'Cantidad', ancho: 14 },
        ],
        filas: [...resumenRol.entries()]
          .map(([rol, cantidad]) => ({ rol, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
        totales: { cantidad: total },
      },
      {
        nombre: 'Usuarios',
        columnas: [
          { clave: 'id', encabezado: 'ID', ancho: 14 },
          { clave: 'nombre', encabezado: 'Nombre', ancho: 30 },
          { clave: 'email', encabezado: 'Correo', ancho: 32 },
          { clave: 'activo', encabezado: 'Activo', ancho: 10 },
          { clave: 'acceso', encabezado: 'Acceso', ancho: 10 },
          { clave: 'rol', encabezado: 'Rol', ancho: 22 },
          { clave: 'rolActivo', encabezado: 'Rol activo', ancho: 12 },
          { clave: 'departamento', encabezado: 'Departamento', ancho: 24 },
          { clave: 'ubicacion', encabezado: 'Ubicación', ancho: 22 },
          { clave: 'puesto', encabezado: 'Puesto', ancho: 24 },
          { clave: 'tipoUsuario', encabezado: 'Tipo de usuario', ancho: 20 },
          { clave: 'permisosExtra', encabezado: 'Permisos extra', ancho: 40 },
          { clave: 'permisosRevocados', encabezado: 'Permisos revocados', ancho: 40 },
          { clave: 'permisosEfectivos', encabezado: 'Permisos efectivos', ancho: 60 },
        ],
        filas: detalle,
      },
    ],
  };
};

export const usuariosPermisosReporte: ReporteDefinicion = {
  codigo: 'usuarios-permisos',
  nombre: 'Usuarios, roles y permisos',
  descripcion:
    'Usuarios activos/inactivos con rol, catálogos y permisos efectivos; no expone hashes de contraseña.',
  modulo: 'Usuarios / RBAC',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['usuarios:administrar'],
  filtros: [
    {
      nombre: 'activo',
      tipo: 'booleano',
      descripcion: 'Incluye usuarios activos o inactivos. Default true.',
    },
    {
      nombre: 'rolId',
      tipo: 'texto',
      descripcion: 'ID del rol.',
    },
    {
      nombre: 'departamentoId',
      tipo: 'texto',
      descripcion: 'ID del departamento.',
    },
    {
      nombre: 'ubicacionId',
      tipo: 'texto',
      descripcion: 'ID de la ubicación.',
    },
    {
      nombre: 'puestoId',
      tipo: 'texto',
      descripcion: 'ID del puesto.',
    },
    {
      nombre: 'tipoUsuarioId',
      tipo: 'texto',
      descripcion: 'ID del tipo de usuario.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en ID, nombre o correo.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarUsuarios,
};
