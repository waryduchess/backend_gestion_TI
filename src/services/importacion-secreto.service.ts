import { prisma } from '../config/prisma';
import { cifrar } from '../utils/crypto';
import { comoTexto } from '../utils/validacion';
import { registrarAuditoria } from './auditoria.service';
import {
  COLUMNAS_IMPORTACION_SECRETOS,
  DatosFilaImportadaSecreto,
  FilaImportacionSecretoCruda,
  ResultadoConfirmacionImportacionSecreto,
  ResultadoFilaImportacionSecreto,
  ResultadoValidacionImportacionSecreto,
} from '../models/importacion-secreto.model';

const CAMPO_AUDITORIA_CREACION = [
  'tipo',
  'proyecto',
  'nombre',
  'usuario',
  'password',
  'comentario',
];

const textoONull = (valor: unknown): string | null => {
  const texto = comoTexto(valor);
  return texto === '' ? null : texto;
};

const comoFila = (valor: unknown, porDefecto: number): number => {
  const texto = typeof valor === 'number' ? String(valor) : comoTexto(valor);

  if (/^\d+$/.test(texto)) {
    const numero = Number(texto);
    if (numero >= 1) {
      return numero;
    }
  }

  return porDefecto;
};

const leerPassword = (valor: unknown, errores: string[]): string | null => {
  if (typeof valor !== 'string' || valor.length === 0) {
    errores.push('La contraseña es obligatoria');
    return null;
  }

  if (Buffer.byteLength(valor, 'utf8') > 65000) {
    errores.push(
      'La contraseña excede el tamaño maximo permitido (65000 bytes)'
    );
    return null;
  }

  return valor;
};

const claveDuplicado = (
  tipo: string | null,
  nombre: string,
  usuario: string | null
): string =>
  [
    (tipo ?? '').toLowerCase(),
    nombre.toLowerCase(),
    (usuario ?? '').toLowerCase(),
  ].join('\u0000');

interface FilaIntermedia {
  fila: number;
  tipo: string | null;
  nombre: string;
  usuario: string | null;
  password: string | null;
  comentario: string | null;
  errores: string[];
  advertencias: string[];
}

const mapearFila = (
  cruda: FilaImportacionSecretoCruda,
  indice: number
): FilaIntermedia => {
  const errores: string[] = [];
  const advertencias: string[] = [];

  const nombre = comoTexto(cruda[COLUMNAS_IMPORTACION_SECRETOS.nombre]);

  if (nombre === '') {
    errores.push('El nombre es obligatorio');
  }

  return {
    fila: comoFila(cruda.fila, indice + 1),
    tipo: textoONull(cruda[COLUMNAS_IMPORTACION_SECRETOS.tipo]),
    nombre,
    usuario: textoONull(cruda[COLUMNAS_IMPORTACION_SECRETOS.usuario]),
    password: leerPassword(
      cruda[COLUMNAS_IMPORTACION_SECRETOS.password],
      errores
    ),
    comentario: textoONull(cruda[COLUMNAS_IMPORTACION_SECRETOS.comentario]),
    errores,
    advertencias,
  };
};

const construirIntermedias = (
  filas: FilaImportacionSecretoCruda[]
): FilaIntermedia[] =>
  filas.map((cruda, indice) =>
    typeof cruda === 'object' && cruda !== null && !Array.isArray(cruda)
      ? mapearFila(cruda as FilaImportacionSecretoCruda, indice)
      : (() => {
          const fila = mapearFila({}, indice);
          fila.errores.unshift('La fila no es un objeto valido');
          return fila;
        })()
  );

const duplicadosActivos = async (
  intermedias: FilaIntermedia[]
): Promise<Set<string>> => {
  const nombres = [
    ...new Set(
      intermedias
        .map((fila) => fila.nombre)
        .filter((nombre) => nombre !== '')
    ),
  ];

  if (nombres.length === 0) {
    return new Set<string>();
  }

  const existentes = await prisma.secreto.findMany({
    where: { activo: true, nombre: { in: nombres } },
    select: { tipo: true, nombre: true, usuario: true },
  });

  return new Set(
    existentes
      .filter(
        (fila): fila is { tipo: string | null; nombre: string; usuario: string | null } =>
          fila.nombre !== null
      )
      .map((fila) => claveDuplicado(fila.tipo, fila.nombre, fila.usuario))
  );
};

interface FilaEvaluada {
  fila: number;
  valido: boolean;
  errores: string[];
  advertencias: string[];
  datos: DatosFilaImportadaSecreto | null;
  password: string | null;
}

const evaluar = async (
  filas: FilaImportacionSecretoCruda[]
): Promise<FilaEvaluada[]> => {
  const intermedias = construirIntermedias(filas);
  const existentes = await duplicadosActivos(intermedias);
  const vistos = new Set<string>();

  return intermedias.map((fila) => {
    const errores = [...fila.errores];

    if (errores.length === 0) {
      const clave = claveDuplicado(fila.tipo, fila.nombre, fila.usuario);
      if (existentes.has(clave)) {
        errores.push(
          `Ya existe un secreto activo con el nombre "${fila.nombre}", tipo y usuario indicados`
        );
      } else if (vistos.has(clave)) {
        errores.push(
          `El secreto "${fila.nombre}" esta repetido en el lote`
        );
      } else {
        vistos.add(clave);
      }
    }

    const valido = errores.length === 0;

    return {
      fila: fila.fila,
      valido,
      errores,
      advertencias: fila.advertencias,
      datos: valido
        ? {
            tipo: fila.tipo,
            nombre: fila.nombre,
            usuario: fila.usuario,
            comentario: fila.comentario,
          }
        : null,
      password: valido ? fila.password : null,
    };
  });
};

export const validarImportacionSecretos = async (
  filas: FilaImportacionSecretoCruda[]
): Promise<ResultadoValidacionImportacionSecreto> => {
  const evaluadas = await evaluar(filas);

  const resultados: ResultadoFilaImportacionSecreto[] = evaluadas.map(
    (fila) => ({
      fila: fila.fila,
      valido: fila.valido,
      errores: fila.errores,
      advertencias: fila.advertencias,
      datos: fila.datos,
    })
  );

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

export const confirmarImportacionSecretos = async (
  usuarioId: string,
  filas: FilaImportacionSecretoCruda[]
): Promise<ResultadoConfirmacionImportacionSecreto> => {
  const evaluadas = await evaluar(filas);
  const resultados: ResultadoConfirmacionImportacionSecreto['filas'] = [];

  for (const fila of evaluadas) {
    if (!fila.valido || fila.datos === null || fila.password === null) {
      resultados.push({
        fila: fila.fila,
        creado: false,
        secretoId: null,
        errores: fila.errores,
        advertencias: fila.advertencias,
      });
      continue;
    }

    const datos = fila.datos;
    const password = fila.password;

    try {
      const creado = await prisma.$transaction(async (tx) => {
        const nuevo = await tx.secreto.create({
          data: {
            tipo: datos.tipo,
            proyecto: null,
            nombre: datos.nombre,
            usuario: datos.usuario,
            password: cifrar(password),
            comentario: datos.comentario,
          },
          select: { id: true },
        });
        await tx.auditoriaSecreto.create({
          data: {
            secretoId: nuevo.id,
            usuarioId,
            accion: 'CREAR',
            campos: CAMPO_AUDITORIA_CREACION,
          },
        });
        return nuevo;
      });

      resultados.push({
        fila: fila.fila,
        creado: true,
        secretoId: creado.id,
        errores: [],
        advertencias: fila.advertencias,
      });
    } catch {
      resultados.push({
        fila: fila.fila,
        creado: false,
        secretoId: null,
        errores: ['No se pudo crear el secreto'],
        advertencias: fila.advertencias,
      });
    }
  }

  const creadas = resultados.filter((fila) => fila.creado).length;
  const rechazadas = resultados.length - creadas;

  if (creadas > 0) {
    await registrarAuditoria(prisma, {
      modulo: 'IMPORTACIONES',
      accion: 'IMPORTAR',
      entidadId: null,
      usuarioId,
      detalle: {
        resumen: { total: resultados.length, creadas, rechazadas },
      },
    });
  }

  return {
    resumen: {
      total: resultados.length,
      creadas,
      rechazadas,
    },
    filas: resultados,
  };
};
