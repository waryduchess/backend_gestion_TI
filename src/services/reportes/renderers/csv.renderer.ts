import { ReporteDocumento } from '../../../models/reporte.model';
import {
  filaConTotales,
  sanitizarCelda,
  valorTexto,
  validarDocumento,
} from './comun';

const escaparCsv = (valor: unknown): string => {
  const texto = valorTexto(sanitizarCelda(valor));
  return /[",\n\r]/.test(texto)
    ? `"${texto.replace(/"/g, '""')}"`
    : texto;
};

export const renderizarCsv = (documento: ReporteDocumento): Buffer => {
  validarDocumento(documento);
  const lineas: string[] = [];

  lineas.push(`Reporte,${escaparCsv(documento.titulo)}`);
  if (documento.subtitulo) {
    lineas.push(`Subtitulo,${escaparCsv(documento.subtitulo)}`);
  }
  lineas.push(`Generado en,${escaparCsv(documento.generadoEn.toISOString())}`);
  lineas.push(`Generado por,${escaparCsv(documento.generadoPor)}`);
  for (const [clave, valor] of Object.entries(documento.metadatos)) {
    lineas.push(`${escaparCsv(clave)},${escaparCsv(valor)}`);
  }
  lineas.push('');

  for (const seccion of documento.secciones) {
    lineas.push(escaparCsv(seccion.nombre));
    lineas.push(seccion.columnas.map((c) => escaparCsv(c.encabezado)).join(','));
    for (const fila of seccion.filas) {
      lineas.push(seccion.columnas.map((c) => escaparCsv(fila[c.clave])).join(','));
    }
    const totales = filaConTotales(seccion);
    if (totales) {
      lineas.push(seccion.columnas.map((c) => escaparCsv(totales[c.clave])).join(','));
    }
    lineas.push('');
  }

  return Buffer.from(`\uFEFF${lineas.join('\r\n')}`, 'utf8');
};
