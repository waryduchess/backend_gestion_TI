import puppeteer, { Browser } from 'puppeteer';
import { HttpError } from '../../../middlewares/error.middleware';
import { ReporteDocumento } from '../../../models/reporte.model';
import { escaparHtml, validarDocumento } from './comun';

const construirHtml = (documento: ReporteDocumento): string => {
  const metadatos = Object.entries(documento.metadatos)
    .map(
      ([clave, valor]) =>
        `<tr><th>${escaparHtml(clave)}</th><td>${escaparHtml(valor)}</td></tr>`
    )
    .join('');

  const secciones = documento.secciones
    .map((seccion) => {
      const cabeceras = seccion.columnas
        .map((columna) => `<th>${escaparHtml(columna.encabezado)}</th>`)
        .join('');
      const filas = seccion.filas
        .map(
          (fila) =>
            `<tr>${seccion.columnas
              .map((columna) => `<td>${escaparHtml(fila[columna.clave])}</td>`)
              .join('')}</tr>`
        )
        .join('');
      const totales = seccion.totales
        ? `<tr class="totales">${seccion.columnas
            .map((columna) => `<td>${escaparHtml(seccion.totales?.[columna.clave])}</td>`)
            .join('')}</tr>`
        : '';
      return `<section><h2>${escaparHtml(seccion.nombre)}</h2>
        <table><thead><tr>${cabeceras}</tr></thead>
        <tbody>${filas}${totales}</tbody></table></section>`;
    })
    .join('');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<style>
  body { font-family: Arial, sans-serif; color: #222; font-size: 10px; }
  h1 { color: #1f4e78; margin: 0 0 4px; font-size: 20px; }
  h2 { color: #1f4e78; font-size: 13px; margin: 18px 0 6px; }
  .subtitulo { color: #555; margin-bottom: 12px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .meta th { text-align: left; width: 25%; background: #eef3f8; padding: 4px; }
  .meta td { padding: 4px; border-bottom: 1px solid #ddd; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1f4e78; color: #fff; padding: 5px; text-align: left; }
  td { border-bottom: 1px solid #ddd; padding: 4px; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f9fb; }
  .totales td { font-weight: bold; background: #eef3f8; }
  section { page-break-inside: auto; }
  tr { page-break-inside: avoid; }
</style></head><body>
  <h1>${escaparHtml(documento.titulo)}</h1>
  ${documento.subtitulo ? `<div class="subtitulo">${escaparHtml(documento.subtitulo)}</div>` : ''}
  <table class="meta"><tbody>
    <tr><th>Generado en</th><td>${escaparHtml(documento.generadoEn.toISOString())}</td></tr>
    <tr><th>Generado por</th><td>${escaparHtml(documento.generadoPor)}</td></tr>
    ${metadatos}
  </tbody></table>
  ${secciones}
</body></html>`;
};

export const renderizarPdf = async (
  documento: ReporteDocumento
): Promise<Buffer> => {
  validarDocumento(documento);
  let navegador: Browser | null = null;

  try {
    navegador = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined,
    });
    const pagina = await navegador.newPage();
    await pagina.setContent(construirHtml(documento), {
      waitUntil: 'domcontentloaded',
    });
    const pdf = await pagina.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (error) {
    console.error('[REPORTES] No se pudo generar el PDF', error);
    throw new HttpError(
      503,
      'La generación de PDF no está disponible en este entorno'
    );
  } finally {
    if (navegador) await navegador.close();
  }
};
