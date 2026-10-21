import { Prisma } from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import { HttpError } from '../../../middlewares/error.middleware';
import { comoEntero, validarOpcion } from '../../../utils/validacion';

const MAX_FILAS = 10000;
const DIAS_POR_DEFECTO = 30;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const VIGENCIAS = ['TODAS', 'VIGENTES', 'POR_VENCER', 'VENCIDAS'] as const;

type Vigencia = (typeof VIGENCIAS)[number];

const textoOpcional = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
};

const validarFiltros = (
  query: Record<string, unknown>
): Record<string, unknown> => {
  const valorVigencia =
    typeof query.vigencia === 'string'
      ? query.vigencia.trim().toUpperCase()
      : query.vigencia;
  const vigencia =
    (validarOpcion(valorVigencia, 'vigencia', [...VIGENCIAS]) as
      | Vigencia
      | undefined) ?? 'TODAS';

  const dias = comoEntero(query.dias, 'dias', DIAS_POR_DEFECTO);
  if (dias < 1 || dias > 365) {
    throw new HttpError(400, 'El parámetro "dias" debe estar entre 1 y 365', [
      { campo: 'dias', valor: String(dias) },
    ]);
  }

  const activaTexto = validarOpcion(query.activa, 'activa', [
    'true',
    'false',
  ]);
  const activa = activaTexto === undefined ? true : activaTexto === 'true';

  return {
    vigencia,
    dias,
    activa,
    proveedor: textoOpcional(query.proveedor),
    q: textoOpcional(query.q),
  };
};

const cargarLicencias = async (
  filtros: Record<string, unknown>
): Promise<ReporteDocumento> => {
  const vigencia = filtros.vigencia as Vigencia;
  const dias = filtros.dias as number;
  const activa = filtros.activa as boolean;
  const proveedor = filtros.proveedor as string | undefined;
  const q = filtros.q as string | undefined;

  const inicioDia = new Date();
  inicioDia.setUTCHours(0, 0, 0, 0);
  const finVentana = new Date(
    inicioDia.getTime() + (dias + 1) * MILISEGUNDOS_POR_DIA
  );

  const filtroFecha: Prisma.LicenciaWhereInput =
    vigencia === 'VENCIDAS'
      ? { fechaVencimiento: { lt: inicioDia } }
      : vigencia === 'POR_VENCER'
        ? { fechaVencimiento: { gte: inicioDia, lt: finVentana } }
        : vigencia === 'VIGENTES'
          ? { fechaVencimiento: { gte: finVentana } }
          : {};

  const where: Prisma.LicenciaWhereInput = {
    activa,
    ...filtroFecha,
    ...(proveedor ? { proveedor: { contains: proveedor } } : {}),
    ...(q
      ? {
          OR: [
            { software: { contains: q } },
            { proveedor: { contains: q } },
          ],
        }
      : {}),
  };

  const [filas, total] = await Promise.all([
    prisma.licencia.findMany({
      where,
      orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        software: true,
        proveedor: true,
        clave: true,
        fechaCompra: true,
        fechaVencimiento: true,
        activa: true,
        asignadaA: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
      },
    }),
    prisma.licencia.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} filas; aplica más filtros`
    );
  }

  return {
    titulo: 'Reporte de licencias por vigencia',
    subtitulo: `Total de registros: ${total}`,
    generadoEn: new Date(),
    generadoPor: 'Sistema',
    metadatos: {
      'Vigencia': vigencia,
      'Días de aviso': String(dias),
      'Estado activo': activa ? 'Solo activas' : 'Solo inactivas',
      'Proveedor': proveedor ?? 'Todos',
      'Búsqueda': q ?? 'Sin búsqueda',
      'Registros exportados': String(filas.length),
    },
    secciones: [
      {
        nombre: 'Licencias',
        columnas: [
          { clave: 'id', encabezado: 'ID', ancho: 8 },
          { clave: 'software', encabezado: 'Software', ancho: 28 },
          { clave: 'proveedor', encabezado: 'Proveedor', ancho: 22 },
          { clave: 'fechaCompra', encabezado: 'Fecha de compra', ancho: 18 },
          { clave: 'fechaVencimiento', encabezado: 'Fecha de vencimiento', ancho: 20 },
          { clave: 'estadoVigencia', encabezado: 'Vigencia', ancho: 16 },
          { clave: 'diasRestantes', encabezado: 'Días restantes', ancho: 16 },
          { clave: 'activa', encabezado: 'Activa', ancho: 10 },
          { clave: 'tieneClave', encabezado: 'Tiene clave', ancho: 12 },
          { clave: 'asignadaA', encabezado: 'Asignada a', ancho: 28 },
          { clave: 'correoAsignado', encabezado: 'Correo asignado', ancho: 30 },
        ],
        filas: filas.map((fila) => {
          const fechaVencimiento = fila.fechaVencimiento;
          const diasRestantes = Math.ceil(
            (fechaVencimiento.getTime() - inicioDia.getTime()) /
              MILISEGUNDOS_POR_DIA
          );
          const estadoVigencia =
            diasRestantes < 0
              ? 'VENCIDA'
              : diasRestantes <= dias
                ? 'POR_VENCER'
                : 'VIGENTE';

          return {
            id: fila.id,
            software: fila.software,
            proveedor: fila.proveedor,
            fechaCompra: fila.fechaCompra,
            fechaVencimiento,
            estadoVigencia,
            diasRestantes,
            activa: fila.activa,
            tieneClave: fila.clave !== null,
            asignadaA: fila.asignadaA?.nombre ?? null,
            correoAsignado: fila.asignadaA?.email ?? null,
          };
        }),
      },
    ],
  };
};

export const licenciasVigenciaReporte: ReporteDefinicion = {
  codigo: 'licencias-vigencia',
  nombre: 'Licencias por vigencia',
  descripcion:
    'Licencias activas o inactivas clasificadas como vigentes, por vencer o vencidas.',
  modulo: 'Licencias',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['licencias:administrar'],
  filtros: [
    {
      nombre: 'vigencia',
      tipo: 'enum',
      descripcion: 'Filtra por vigencia. Default TODAS.',
      opciones: [...VIGENCIAS],
    },
    {
      nombre: 'dias',
      tipo: 'texto',
      descripcion: 'Días de aviso para considerar una licencia por vencer. Default 30.',
    },
    {
      nombre: 'activa',
      tipo: 'booleano',
      descripcion: 'Incluye solo activas (true) o solo inactivas (false). Default true.',
    },
    {
      nombre: 'proveedor',
      tipo: 'texto',
      descripcion: 'Filtra por proveedor.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en software o proveedor.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarLicencias,
};
