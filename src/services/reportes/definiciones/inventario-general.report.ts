import { EstadoActivo, Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import { validarOpcion } from '../../../utils/validacion';
import { HttpError } from '../../../middlewares/error.middleware';

const MAX_FILAS = 10000;

const validarTexto = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
};

const validarFiltros = (
  query: Record<string, unknown>
): Record<string, unknown> => {
  const estado = validarOpcion(
    query.estado,
    'estado',
    Object.values(EstadoActivo)
  );
  const tipo = validarTexto(query.tipo);
  const sucursal = validarTexto(query.sucursal);
  const q = validarTexto(query.q);
  return { estado, tipo, sucursal, q };
};

const cargarInventario = async (
  filtros: Record<string, unknown>,
  usuario: { id: string; nombre: string; email: string | null }
): Promise<ReporteDocumento> => {
  const estado = filtros.estado as EstadoActivo | undefined;
  const tipo = filtros.tipo as string | undefined;
  const sucursal = filtros.sucursal as string | undefined;
  const q = filtros.q as string | undefined;

  const where: Prisma.ActivoWhereInput = {
    ...(estado ? { estado } : { estado: { not: EstadoActivo.DE_BAJA } }),
    ...(tipo ? { tipo: { contains: tipo } } : {}),
    ...(sucursal ? { sucursal: { contains: sucursal } } : {}),
    ...(q
      ? {
          OR: [
            { claveActivo: { contains: q } },
            { cb23: { contains: q } },
            { numeroSerie: { contains: q } },
            { modelo: { contains: q } },
            { marca: { contains: q } },
            { nombreRed: { contains: q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.activo.findMany({
      where,
      orderBy: [{ claveActivo: 'asc' }, { id: 'asc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        claveActivo: true,
        cb23: true,
        tipo: true,
        marca: true,
        modelo: true,
        numeroSerie: true,
        sucursal: true,
        estado: true,
        estadoGeneral: true,
        nombreRed: true,
        anydesk: true,
        responsable: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    }),
    prisma.activo.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  return {
    titulo: 'Reporte general de inventario',
    subtitulo: `Total de registros: ${total}`,
    generadoEn: new Date(),
    generadoPor: usuario.nombre,
    metadatos: {
      'Filtro de estado': estado ?? 'Todos excepto DE_BAJA',
      'Filtro de tipo': tipo ?? 'Todos',
      'Filtro de sucursal': sucursal ?? 'Todas',
      'Búsqueda': q ?? 'Sin búsqueda',
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Inventario',
        columnas: [
          { clave: 'claveActivo', encabezado: 'Clave de activo', ancho: 16 },
          { clave: 'cb23', encabezado: 'CB23', ancho: 18 },
          { clave: 'tipo', encabezado: 'Tipo', ancho: 16 },
          { clave: 'marca', encabezado: 'Marca', ancho: 16 },
          { clave: 'modelo', encabezado: 'Modelo', ancho: 22 },
          { clave: 'numeroSerie', encabezado: 'Número de serie', ancho: 22 },
          { clave: 'sucursal', encabezado: 'Sucursal', ancho: 16 },
          { clave: 'estado', encabezado: 'Estado', ancho: 18 },
          { clave: 'estadoGeneral', encabezado: 'Estado general', ancho: 18 },
          { clave: 'nombreRed', encabezado: 'Nombre de red', ancho: 18 },
          { clave: 'anydesk', encabezado: 'AnyDesk', ancho: 18 },
          { clave: 'responsableNombre', encabezado: 'Responsable', ancho: 28 },
          { clave: 'responsableEmail', encabezado: 'Correo responsable', ancho: 30 },
        ],
        filas: filas.map((fila) => ({
          claveActivo: fila.claveActivo,
          cb23: fila.cb23,
          tipo: fila.tipo,
          marca: fila.marca,
          modelo: fila.modelo,
          numeroSerie: fila.numeroSerie,
          sucursal: fila.sucursal,
          estado: fila.estado,
          estadoGeneral: fila.estadoGeneral,
          nombreRed: fila.nombreRed,
          anydesk: fila.anydesk,
          responsableNombre: fila.responsable?.nombre ?? null,
          responsableEmail: fila.responsable?.email ?? null,
        })),
      },
    ],
  };
};

export const inventarioGeneralReporte: ReporteDefinicion = {
  codigo: 'inventario-general',
  nombre: 'Inventario general',
  descripcion:
    'Inventario de activos por estado, tipo, sucursal, responsable y texto.',
  modulo: 'Activos',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['activos:leer'],
  filtros: [
    {
      nombre: 'estado',
      tipo: 'enum',
      descripcion: 'Estado del activo. Si se omite, excluye DE_BAJA.',
      opciones: Object.values(EstadoActivo),
    },
    {
      nombre: 'tipo',
      tipo: 'texto',
      descripcion: 'Tipo de activo, por ejemplo Laptop o Desktop.',
    },
    {
      nombre: 'sucursal',
      tipo: 'texto',
      descripcion: 'Sucursal del activo.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion:
        'Busca en clave, CB23, serie, modelo, marca o nombre de red.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarInventario,
};
