import {
  ReporteDefinicion,
  ReporteMetadata,
} from '../../models/reporte.model';

const definiciones = new Map<string, ReporteDefinicion>();

export const registrarReporte = (definicion: ReporteDefinicion): void => {
  if (definiciones.has(definicion.codigo)) {
    throw new Error(`El reporte "${definicion.codigo}" ya está registrado`);
  }
  definiciones.set(definicion.codigo, definicion);
};

export const obtenerDefinicionReporte = (
  codigo: string
): ReporteDefinicion | undefined => definiciones.get(codigo);

export const listarDefinicionesReportes = (): ReporteDefinicion[] =>
  [...definiciones.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  );

export const mapearMetadataReporte = (
  definicion: ReporteDefinicion
): ReporteMetadata => ({
  codigo: definicion.codigo,
  nombre: definicion.nombre,
  descripcion: definicion.descripcion,
  modulo: definicion.modulo,
  formatos: definicion.formatos,
  permisos: definicion.permisos,
  filtros: definicion.filtros,
  maxFilas: definicion.maxFilas,
});
