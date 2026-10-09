import { EstadoActivo, Prisma } from '../generated/prisma/client';
import { prisma } from '../config/prisma';
import { comoTexto } from '../utils/validacion';
import {
  COLUMNAS_IMPORTACION,
  DatosFilaImportada,
  FilaImportacionCruda,
  ResultadoConfirmacionImportacion,
  ResultadoFilaImportacion,
  ResultadoValidacionImportacion,
} from '../models/importacion-activo.model';

const ESTADOS_VALIDOS: string[] = Object.values(EstadoActivo);

const textoONull = (valor: unknown): string | null => {
  const texto = comoTexto(valor);
  return texto === '' ? null : texto;
};

const comoFila = (valor: unknown, porDefecto: number): number => {
  const texto =
    typeof valor === 'number' ? String(valor) : comoTexto(valor);

  if (/^\d+$/.test(texto)) {
    const numero = Number(texto);
    if (numero >= 1) {
      return numero;
    }
  }

  return porDefecto;
};

const extraerEstado = (valor: unknown, errores: string[]): EstadoActivo => {
  const texto = comoTexto(valor).toUpperCase();

  if (texto === '') {
    return EstadoActivo.EN_USO;
  }

  if (!ESTADOS_VALIDOS.includes(texto)) {
    errores.push(
      `El estado "${texto}" no es valido; permitidos: ${ESTADOS_VALIDOS.join(', ')}`
    );
    return EstadoActivo.EN_USO;
  }

  return texto as EstadoActivo;
};

interface FilaIntermedia {
  fila: number;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  cb23: string | null;
  numeroSerie: string | null;
  sucursal: string | null;
  estadoGeneral: string | null;
  nombreRed: string | null;
  estado: EstadoActivo;
  correo: string | null;
  errores: string[];
  advertencias: string[];
}

const mapearFila = (cruda: FilaImportacionCruda, indice: number): FilaIntermedia => {
  const fila = comoFila(cruda.fila, indice + 1);
  const errores: string[] = [];
  const advertencias: string[] = [];

  const tipo = comoTexto(cruda[COLUMNAS_IMPORTACION.tipo]);

  if (tipo === '') {
    errores.push('El tipo es obligatorio');
  }

  return {
    fila,
    tipo,
    marca: textoONull(cruda[COLUMNAS_IMPORTACION.marca]),
    modelo: textoONull(cruda[COLUMNAS_IMPORTACION.modelo]),
    cb23: textoONull(cruda[COLUMNAS_IMPORTACION.cb23]),
    numeroSerie: textoONull(cruda[COLUMNAS_IMPORTACION.numeroSerie]),
    sucursal: textoONull(cruda[COLUMNAS_IMPORTACION.sucursal]),
    estadoGeneral: textoONull(cruda[COLUMNAS_IMPORTACION.estadoGeneral]),
    nombreRed: textoONull(cruda[COLUMNAS_IMPORTACION.nombreRed]),
    estado: extraerEstado(cruda[COLUMNAS_IMPORTACION.estado], errores),
    correo: textoONull(cruda[COLUMNAS_IMPORTACION.correoResponsable]),
    errores,
    advertencias,
  };
};

const resolverResponsables = async (
  filas: FilaIntermedia[]
): Promise<Map<string, string[]>> => {
  const correos = [
    ...new Set(
      filas
        .map((fila) => fila.correo)
        .filter((correo): correo is string => correo !== null)
    ),
  ];

  const mapa = new Map<string, string[]>();

  if (correos.length === 0) {
    return mapa;
  }

  const usuarios = await prisma.usuario.findMany({
    where: { email: { in: correos }, activo: true },
    select: { id: true, email: true },
  });

  for (const usuario of usuarios) {
    if (usuario.email === null) {
      continue;
    }

    const ids = mapa.get(usuario.email) ?? [];
    ids.push(usuario.id);
    mapa.set(usuario.email, ids);
  }

  return mapa;
};

const responsablesPorFila = (
  filas: FilaIntermedia[],
  usuariosPorCorreo: Map<string, string[]>
): Map<FilaIntermedia, string | null> => {
  const asignados = new Map<FilaIntermedia, string | null>();

  for (const fila of filas) {
    if (fila.correo === null) {
      fila.advertencias.push(
        'La fila no trae "Correo responsable"; se importara sin responsable'
      );
      asignados.set(fila, null);
      continue;
    }

    const ids = usuariosPorCorreo.get(fila.correo) ?? [];

    if (ids.length === 1) {
      asignados.set(fila, ids[0]);
      continue;
    }

    fila.advertencias.push(
      ids.length === 0
        ? `No se encontro un usuario activo con el correo "${fila.correo}"; se importara sin responsable`
        : `El correo "${fila.correo}" coincide con varios usuarios activos; se importara sin responsable`
    );
    asignados.set(fila, null);
  }

  return asignados;
};

const duplicadosExistentes = async (filas: FilaIntermedia[]) => {
  const validas = filas.filter((fila) => fila.errores.length === 0);

  const cb23s = [
    ...new Set(
      validas
        .map((fila) => fila.cb23)
        .filter((valor): valor is string => valor !== null)
    ),
  ];
  const series = [
    ...new Set(
      validas
        .map((fila) => fila.numeroSerie)
        .filter((valor): valor is string => valor !== null)
    ),
  ];

  if (cb23s.length === 0 && series.length === 0) {
    return { cb23: new Set<string>(), numeroSerie: new Set<string>() };
  }

  const existentes = await prisma.activo.findMany({
    where: {
      OR: [
        ...(cb23s.length > 0 ? [{ cb23: { in: cb23s } }] : []),
        ...(series.length > 0 ? [{ numeroSerie: { in: series } }] : []),
      ],
    },
    select: { cb23: true, numeroSerie: true },
  });

  return {
    cb23: new Set(
      existentes
        .map((activo) => activo.cb23)
        .filter((valor): valor is string => valor !== null)
    ),
    numeroSerie: new Set(
      existentes
        .map((activo) => activo.numeroSerie)
        .filter((valor): valor is string => valor !== null)
    ),
  };
};

export const validarImportacion = async (
  filas: FilaImportacionCruda[]
): Promise<ResultadoValidacionImportacion> => {
  const intermedias = filas.map((cruda, indice) =>
    typeof cruda === 'object' && cruda !== null && !Array.isArray(cruda)
      ? mapearFila(cruda as FilaImportacionCruda, indice)
      : (() => {
          const fila = mapearFila({}, indice);
          fila.errores.unshift('La fila no es un objeto valido');
          return fila;
        })()
  );

  const [usuariosPorCorreo, existentes] = await Promise.all([
    resolverResponsables(intermedias),
    duplicadosExistentes(intermedias),
  ]);

  const responsables = responsablesPorFila(intermedias, usuariosPorCorreo);

  const vistosCb23 = new Set<string>();
  const vistosSeries = new Set<string>();
  const resultados: ResultadoFilaImportacion[] = [];

  for (const fila of intermedias) {
    const errores = [...fila.errores];
    const responsableId = responsables.get(fila) ?? null;

    if (errores.length === 0 && fila.cb23 !== null) {
      if (existentes.cb23.has(fila.cb23)) {
        errores.push(`Ya existe un activo con el CB23 "${fila.cb23}"`);
      } else if (vistosCb23.has(fila.cb23)) {
        errores.push(`El CB23 "${fila.cb23}" esta repetido en el lote`);
      } else {
        vistosCb23.add(fila.cb23);
      }
    }

    if (errores.length === 0 && fila.numeroSerie !== null) {
      if (existentes.numeroSerie.has(fila.numeroSerie)) {
        errores.push(
          `Ya existe un activo con el numero de serie "${fila.numeroSerie}"`
        );
      } else if (vistosSeries.has(fila.numeroSerie)) {
        errores.push(
          `El numero de serie "${fila.numeroSerie}" esta repetido en el lote`
        );
      } else {
        vistosSeries.add(fila.numeroSerie);
      }
    }

    const valido = errores.length === 0;
    const datos: DatosFilaImportada | null = valido
      ? {
          tipo: fila.tipo,
          cb23: fila.cb23,
          marca: fila.marca,
          modelo: fila.modelo,
          numeroSerie: fila.numeroSerie,
          sucursal: fila.sucursal,
          estadoGeneral: fila.estadoGeneral,
          nombreRed: fila.nombreRed,
          estado: fila.estado,
          responsableId,
        }
      : null;

    resultados.push({
      fila: fila.fila,
      valido,
      errores,
      advertencias: fila.advertencias,
      datos,
    });
  }

  const validas = resultados.filter((fila) => fila.valido).length;

  return {
    resumen: {
      total: resultados.length,
      validas,
      invalidas: resultados.length - validas,
    },
    filas: resultados,
  };
};

export const confirmarImportacion = async (
  filas: FilaImportacionCruda[]
): Promise<ResultadoConfirmacionImportacion> => {
  const validacion = await validarImportacion(filas);
  const resultados: ResultadoConfirmacionImportacion['filas'] = [];

  for (const fila of validacion.filas) {
    if (!fila.valido || fila.datos === null) {
      resultados.push({
        fila: fila.fila,
        creado: false,
        activoId: null,
        errores: fila.errores,
        advertencias: fila.advertencias,
      });
      continue;
    }

    try {
      const datos: Prisma.ActivoUncheckedCreateInput = { ...fila.datos };
      const creado = await prisma.activo.create({
        data: datos,
        select: { id: true },
      });

      resultados.push({
        fila: fila.fila,
        creado: true,
        activoId: creado.id,
        errores: [],
        advertencias: fila.advertencias,
      });
    } catch {
      resultados.push({
        fila: fila.fila,
        creado: false,
        activoId: null,
        errores: ['No se pudo crear el activo'],
        advertencias: fila.advertencias,
      });
    }
  }

  const creadas = resultados.filter((fila) => fila.creado).length;

  return {
    resumen: {
      total: resultados.length,
      creadas,
      rechazadas: resultados.length - creadas,
    },
    filas: resultados,
  };
};
