import { ReporteDocumento, ReporteSeccion } from '../../../models/reporte.model';

export const valorTexto = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') return JSON.stringify(valor);
  return String(valor);
};

export const sanitizarCelda = (valor: unknown): unknown => {
  if (typeof valor !== 'string') return valor;
  return /^[=+\-@]/.test(valor) ? `'${valor}` : valor;
};

export const sanitizarNombreHoja = (
  nombre: string,
  usados: Set<string>
): string => {
  const base = nombre.replace(/[\\/?*[\]:]/g, ' ').trim() || 'Hoja';
  let candidato = base.slice(0, 31);
  let indice = 2;
  while (usados.has(candidato)) {
    const sufijo = ` (${indice})`;
    candidato = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
    indice += 1;
  }
  usados.add(candidato);
  return candidato;
};

export const escaparHtml = (valor: unknown): string =>
  valorTexto(valor).replace(/[&<>"']/g, (caracter) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entidades[caracter] ?? caracter;
  });

export const nombreArchivoSeguro = (titulo: string, formato: string): string => {
  const base = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'reporte'}.${formato}`;
};

export const filaConTotales = (
  seccion: ReporteSeccion
): Record<string, unknown> | null => {
  if (!seccion.totales) return null;
  const fila: Record<string, unknown> = {};
  for (const columna of seccion.columnas) {
    fila[columna.clave] = seccion.totales[columna.clave] ?? '';
  }
  fila[seccion.columnas[0]?.clave ?? 'total'] = 'TOTAL';
  return fila;
};

export const validarDocumento = (documento: ReporteDocumento): void => {
  if (documento.secciones.length === 0) {
    throw new Error('El reporte no contiene secciones');
  }
};
