import ExcelJS from 'exceljs';
import { ReporteDocumento } from '../../../models/reporte.model';
import {
  filaConTotales,
  sanitizarCelda,
  sanitizarNombreHoja,
  validarDocumento,
} from './comun';

const aplicarEstiloEncabezado = (fila: ExcelJS.Row): void => {
  fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fila.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  fila.alignment = { vertical: 'middle', horizontal: 'center' };
};

export const renderizarXlsx = async (
  documento: ReporteDocumento
): Promise<Buffer> => {
  validarDocumento(documento);
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Sistema de Gestión de TI';
  libro.created = documento.generadoEn;

  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [
    { header: 'Campo', key: 'campo', width: 28 },
    { header: 'Valor', key: 'valor', width: 70 },
  ];
  aplicarEstiloEncabezado(resumen.getRow(1));
  resumen.addRow({ campo: 'Reporte', valor: documento.titulo });
  if (documento.subtitulo) {
    resumen.addRow({ campo: 'Subtítulo', valor: documento.subtitulo });
  }
  resumen.addRow({
    campo: 'Generado en',
    valor: documento.generadoEn.toISOString(),
  });
  resumen.addRow({ campo: 'Generado por', valor: documento.generadoPor });
  for (const [campo, valor] of Object.entries(documento.metadatos)) {
    resumen.addRow({ campo, valor });
  }

  const hojasUsadas = new Set<string>(['Resumen']);
  for (const seccion of documento.secciones) {
    const hoja = libro.addWorksheet(
      sanitizarNombreHoja(seccion.nombre, hojasUsadas)
    );
    hoja.columns = seccion.columnas.map((columna) => ({
      header: columna.encabezado,
      key: columna.clave,
      width: columna.ancho ?? 22,
    }));
    aplicarEstiloEncabezado(hoja.getRow(1));
    hoja.views = [{ state: 'frozen', ySplit: 1 }];
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: seccion.columnas.length },
    };

    for (const fila of seccion.filas) {
      const datos: Record<string, unknown> = {};
      for (const columna of seccion.columnas) {
        datos[columna.clave] = sanitizarCelda(fila[columna.clave]);
      }
      hoja.addRow(datos);
    }

    const totales = filaConTotales(seccion);
    if (totales) {
      const filaTotales = hoja.addRow(totales);
      filaTotales.font = { bold: true };
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  return Buffer.from(buffer);
};
