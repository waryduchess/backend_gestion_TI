import 'dotenv/config';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';

const RUTA_EXCEL =
  process.env.EXCEL_RUTA ?? '/home/erikg/Estadias/EXCEL DE IT/BD-TECNOLOGIA.xlsx';

const TIPO_SIN_DATO = 'SIN_DATO';

const CIUDADES = new Set([
  'CANCUN',
  'PLAYA',
  'PLAYA DEL CARMEN',
  'MERIDA',
  'CUN',
  'PDC',
]);

const ETIQUETAS_NO_USUARIO = new Set([
  'DISPONIBLE',
  'DANADO',
  'DAÑADO',
  'EXTRAVIADO',
  'ROTO',
  'AREA',
  'RESPONSABLE',
  'SIN ASIGNAR',
  'NINGUNO',
  'FACTURACION',
  'GERENCIA',
  'TI',
  'NI',
  'NA',
  'S/N',
  'NO',
  'SI',
  'COMERCIAL',
  'OPERACIONES',
  'CONTABILIDAD',
  'ADMINISTRACION',
  'RRHH',
  'VENTAS',
  'COMPRAS',
  'STOCK',
  'CUN',
  'PDC',
]);

const SERIE_BASURA = new Set([
  '',
  'NI',
  'NA',
  'N/A',
  'S/N',
  'NONE',
  'NAN',
  '-',
  '.',
  'OK',
  'NO',
  'SI',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const texto = (valor: unknown): string => {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  return String(valor).replace(/\s+/g, ' ').trim();
};

const opcional = (valor: unknown): string | null => {
  const limpio = texto(valor);
  return limpio === '' ? null : limpio;
};

const normalizar = (valor: unknown): string =>
  texto(valor)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const soloSerie = (valor: unknown): string | null => {
  let serie = normalizar(valor);
  for (const prefijo of ['ST:', 'EX:', 'PRODID ']) {
    if (serie.startsWith(prefijo)) {
      serie = serie.slice(prefijo.length).trim();
    }
  }
  if (SERIE_BASURA.has(serie) || serie.length < 4) return null;
  return serie;
};

const serieTexto = (valor: unknown): string | null => {
  const serie = texto(valor);
  if (serie === '' || SERIE_BASURA.has(normalizar(serie))) return null;
  return serie;
};

const soloNumero = (valor: unknown): number | null => {
  const limpio = texto(valor);
  if (!/^\d+$/.test(limpio)) return null;
  return Number(limpio);
};

const aFecha = (valor: unknown): Date | null => {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) return valor;
  const limpio = texto(valor);
  if (limpio === '') return null;
  const conGuiones = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (conGuiones) {
    const fecha = new Date(
      Number(conGuiones[3]),
      Number(conGuiones[2]) - 1,
      Number(conGuiones[1])
    );
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }
  const parseada = Date.parse(limpio);
  return Number.isNaN(parseada) ? null : new Date(parseada);
};

const celda = (celdas: unknown[], indice: number): unknown =>
  celdas[indice + 1] ?? null;

const tokens = (valor: string): string[] =>
  normalizar(valor)
    .split(' ')
    .filter((token) => token.length > 1);

const comoCatalogo = (valor: unknown): string | null => {
  const limpio = opcional(valor);
  if (!limpio) return null;
  if (limpio.length > 40) return null;
  if (/[()]/.test(limpio)) return null;
  return limpio;
};

const aId = (mapa: Map<string, string>, clave: string): number | null => {
  const valor = mapa.get(clave);
  return valor === undefined ? null : Number(valor);
};

// ---------------------------------------------------------------------------
// Fase 1 - Usuarios y catalogos
// ---------------------------------------------------------------------------

interface UsuarioImport {
  id: string;
  nombre: string;
  email: string | null;
  activo: boolean;
  departamento: string | null;
  puesto: string | null;
  ubicacion: string | null;
  tipoUsuario: string | null;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

const leerUsuarios = (hoja: ExcelJS.Worksheet): UsuarioImport[] => {
  const usuarios: UsuarioImport[] = [];
  let consecutivo = 0;

  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero === 1) return;
    const celdas = fila.values as unknown[];

    const nombre = texto(celda(celdas, 5));
    if (nombre === '') return;

    const idOriginal = texto(celda(celdas, 0));
    const id = idOriginal === '' ? `EXT-${String(++consecutivo).padStart(3, '0')}` : idOriginal;

    usuarios.push({
      id,
      nombre,
      email: opcional(celda(celdas, 11)),
      activo: normalizar(celda(celdas, 6)) !== 'NO',
      departamento: comoCatalogo(celda(celdas, 7)),
      puesto: comoCatalogo(celda(celdas, 8)),
      ubicacion: comoCatalogo(celda(celdas, 9)),
      tipoUsuario: comoCatalogo(celda(celdas, 10)),
      fechaInicio: aFecha(celda(celdas, 26)),
      fechaFin: aFecha(celda(celdas, 27)),
    });
  });

  return usuarios;
};

const importarCatalogos = async (
  usuarios: UsuarioImport[]
): Promise<Map<string, string>> => {
  const mapa = new Map<string, string>();

  const reunir = (campo: keyof UsuarioImport): string[] => [
    ...new Set(
      usuarios
        .map((usuario) => usuario[campo])
        .filter((valor): valor is string => typeof valor === 'string')
    ),
  ];

  for (const nombre of reunir('departamento')) {
    const fila = await prisma.departamento.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    mapa.set(`dep:${normalizar(nombre)}`, String(fila.id));
  }

  for (const nombre of reunir('ubicacion')) {
    const fila = await prisma.ubicacion.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    mapa.set(`ubi:${normalizar(nombre)}`, String(fila.id));
  }

  for (const nombre of reunir('puesto')) {
    const fila = await prisma.puesto.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    mapa.set(`pue:${normalizar(nombre)}`, String(fila.id));
  }

  for (const nombre of reunir('tipoUsuario')) {
    const fila = await prisma.tipoUsuario.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    mapa.set(`tip:${normalizar(nombre)}`, String(fila.id));
  }

  return mapa;
};

const importarUsuarios = async (
  usuarios: UsuarioImport[],
  catalogos: Map<string, string>
): Promise<Map<string, string>> => {
  const porNombre = new Map<string, string>();

  for (const usuario of usuarios) {
    const departamentoId = usuario.departamento
      ? aId(catalogos, `dep:${normalizar(usuario.departamento)}`)
      : null;
    const ubicacionId = usuario.ubicacion
      ? aId(catalogos, `ubi:${normalizar(usuario.ubicacion)}`)
      : null;
    const puestoId = usuario.puesto
      ? aId(catalogos, `pue:${normalizar(usuario.puesto)}`)
      : null;
    const tipoUsuarioId = usuario.tipoUsuario
      ? aId(catalogos, `tip:${normalizar(usuario.tipoUsuario)}`)
      : null;

    const datos = {
      nombre: usuario.nombre,
      email: usuario.email,
      activo: usuario.activo,
      fechaInicio: usuario.fechaInicio,
      fechaFin: usuario.fechaFin,
      departamentoId,
      ubicacionId,
      puestoId,
      tipoUsuarioId,
    };

    await prisma.usuario.upsert({
      where: { id: usuario.id },
      update: datos,
      create: { id: usuario.id, ...datos },
    });

    porNombre.set(normalizar(usuario.nombre), usuario.id);
  }

  return porNombre;
};

// ---------------------------------------------------------------------------
// Fase 2 - Activos
// ---------------------------------------------------------------------------

interface ActivoImport {
  claveActivo: string | null;
  cb23: string | null;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numeroParte: string | null;
  numeroSerie: string | null;
  sucursal: string | null;
  anydesk: string | null;
  nombreRed: string | null;
  procesador: string | null;
  memoria: string | null;
  estadoGeneral: string | null;
  notas: string | null;
  responsableId: string | null;
  fuente: 'AF' | 'CODIGO';
}

const combinarNotas = (...partes: string[]): string | null => {
  const limpias = partes.map((parte) => texto(parte)).filter((parte) => parte !== '');
  return limpias.length === 0 ? null : limpias.join(' | ');
};

const buscarResponsable = (
  valor: unknown,
  usuarios: Map<string, string>
): string | null => {
  const etiqueta = normalizar(valor);
  if (etiqueta === '' || etiqueta.includes('@')) return null;
  if (ETIQUETAS_NO_USUARIO.has(etiqueta)) return null;

  const coincidenciaExacta = usuarios.get(etiqueta);
  if (coincidenciaExacta) return coincidenciaExacta;

  const propios = tokens(etiqueta);
  if (propios.length === 0) return null;

  const candidatos: string[] = [];
  for (const [nombre, id] of usuarios) {
    const tokensNombre = tokens(nombre);
    if (tokensNombre.length === 0) continue;

    const excelDentroDelUsuario = propios.every((token) => tokensNombre.includes(token));
    const usuarioDentroDelExcel = tokensNombre.every((token) => propios.includes(token));

    if (excelDentroDelUsuario || usuarioDentroDelExcel) {
      candidatos.push(id);
    }
  }

  return candidatos.length === 1 ? candidatos[0] : null;
};

const leerActivosAF = (
  hoja: ExcelJS.Worksheet,
  usuarios: Map<string, string>
): { filas: ActivoImport[]; conDatos: number; desplazadas: number; vacias: number } => {
  const filas: ActivoImport[] = [];
  let conDatos = 0;
  let desplazadas = 0;
  let vacias = 0;

  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (numero === 1) return;
    const celdas = fila.values as unknown[];

    const clave = texto(celda(celdas, 0));
    if (!clave.toUpperCase().startsWith('AF')) return;

    const col = (indice: number): string => texto(celda(celdas, indice));
    const col1 = col(1);
    const col2 = col(2);

    // Cabecera copiada de otra tabla dentro del mismo renglon AF
    if (col1 === 'CODIGO' || (col1 === '' && col2 === 'Tipo')) {
      filas.push({
        claveActivo: clave,
        cb23: null,
        tipo: TIPO_SIN_DATO,
        marca: null,
        modelo: null,
        numeroParte: null,
        numeroSerie: null,
        sucursal: null,
        anydesk: null,
        nombreRed: null,
        procesador: null,
        memoria: null,
        estadoGeneral: null,
        notas: null,
        responsableId: null,
        fuente: 'AF',
      });
      vacias += 1;
      return;
    }

    // Bloque corrido una columna a la derecha (CB23 cae en la columna de Tipo)
    const desplazadaDerecha = col1 === '' && /^\d{4,}$/.test(col2);
    const tieneDatos = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].some(
      (indice) => col(indice) !== ''
    );

    if (desplazadaDerecha) {
      desplazadas += 1;
      filas.push({
        claveActivo: clave,
        cb23: opcional(col2),
        tipo: col(3) || TIPO_SIN_DATO,
        marca: opcional(col(4)),
        modelo: opcional(col(5)),
        numeroParte: opcional(col(6)),
        numeroSerie: serieTexto(col(7)),
        sucursal: opcional(col(9)),
        anydesk: opcional(col(10)),
        nombreRed: opcional(col(11)),
        procesador: opcional(col(12)),
        memoria: opcional(col(13)),
        estadoGeneral: null,
        notas: combinarNotas(col(15), col(16)),
        responsableId: buscarResponsable(col(8), usuarios),
        fuente: 'AF',
      });
      return;
    }

    if (!tieneDatos) {
      filas.push({
        claveActivo: clave,
        cb23: null,
        tipo: TIPO_SIN_DATO,
        marca: null,
        modelo: null,
        numeroParte: null,
        numeroSerie: null,
        sucursal: null,
        anydesk: null,
        nombreRed: null,
        procesador: null,
        memoria: null,
        estadoGeneral: null,
        notas: null,
        responsableId: null,
        fuente: 'AF',
      });
      vacias += 1;
      return;
    }

    conDatos += 1;

    // Algunos renglones traen Responsable antes de Sucursal
    const sucursalCruda = col(7);
    const sucursalCorrimiento =
      sucursalCruda !== '' &&
      !CIUDADES.has(normalizar(sucursalCruda)) &&
      CIUDADES.has(normalizar(col(8)));
    const off = sucursalCorrimiento ? 1 : 0;

    let responsableTexto = sucursalCorrimiento ? col(7) : col(13);
    let notasTexto = col(14);

    // Algunos renglones dejan el responsable en la columna de Notas
    if (
      responsableTexto === '' &&
      notasTexto !== '' &&
      buscarResponsable(notasTexto, usuarios)
    ) {
      responsableTexto = notasTexto;
      notasTexto = '';
    }

    filas.push({
      claveActivo: clave,
      cb23: opcional(col(1)),
      tipo: col(2) || TIPO_SIN_DATO,
      marca: opcional(col(3)),
      modelo: opcional(col(4)),
      numeroParte: opcional(col(5)),
      numeroSerie: serieTexto(col(6)),
      sucursal: opcional(col(7 + off)),
      anydesk: opcional(col(8 + off)),
      nombreRed: opcional(col(9 + off)),
      procesador: opcional(col(10 + off)),
      memoria: opcional(col(11 + off)),
      estadoGeneral: opcional(col(12 + off)),
      notas: opcional(notasTexto),
      responsableId: buscarResponsable(responsableTexto, usuarios),
      fuente: 'AF',
    });
  });

  return { filas, conDatos, desplazadas, vacias };
};

const leerActivosCodigo = (
  hoja: ExcelJS.Worksheet,
  usuarios: Map<string, string>
): ActivoImport[] => {
  const filas: ActivoImport[] = [];
  let enBloque = false;

  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    const celdas = fila.values as unknown[];
    const col = (indice: number): string => texto(celda(celdas, indice));

    if (col(1) === 'CODIGO') {
      enBloque = true;
      return;
    }
    if (numero === 1) return;
    if (!enBloque) return;

    const codigo = col(1);
    if (codigo === '') return;
    if (normalizar(col(2)) === 'TIPO') return;

    filas.push({
      claveActivo: null,
      cb23: opcional(codigo),
      tipo: col(2) || TIPO_SIN_DATO,
      marca: opcional(col(3)),
      modelo: opcional(col(4)),
      numeroParte: opcional(col(5)),
      numeroSerie: serieTexto(col(6)),
      sucursal: opcional(col(8)),
      anydesk: opcional(col(9)),
      nombreRed: opcional(col(10)),
      procesador: opcional(col(11)),
      memoria: opcional(col(12)),
      estadoGeneral: opcional(col(14)),
      notas: combinarNotas(col(15), col(16)),
      responsableId: buscarResponsable(col(7), usuarios),
      fuente: 'CODIGO',
    });
  });

  return filas;
};

const unificarActivos = (
  origenAf: ActivoImport[],
  origenCodigo: ActivoImport[]
): { activos: ActivoImport[]; fusiones: number; duplicados: number } => {
  const activos: ActivoImport[] = [];
  const porCb23 = new Map<string, ActivoImport>();
  const porSerie = new Map<string, ActivoImport>();
  let fusiones = 0;
  let duplicados = 0;

  const indexar = (activo: ActivoImport): void => {
    if (activo.cb23 && !porCb23.has(activo.cb23)) porCb23.set(activo.cb23, activo);
    const serie = soloSerie(activo.numeroSerie);
    if (serie && !porSerie.has(serie)) porSerie.set(serie, activo);
  };

  const fusionar = (base: ActivoImport, extra: ActivoImport): void => {
    if (base.tipo === TIPO_SIN_DATO && extra.tipo !== TIPO_SIN_DATO) {
      base.tipo = extra.tipo;
    }

    const campos: (keyof ActivoImport)[] = [
      'cb23',
      'marca',
      'modelo',
      'numeroParte',
      'numeroSerie',
      'sucursal',
      'anydesk',
      'nombreRed',
      'procesador',
      'memoria',
      'estadoGeneral',
      'notas',
      'responsableId',
    ];

    for (const campo of campos) {
      if (base[campo] === null && extra[campo] !== null) {
        (base as unknown as Record<string, unknown>)[campo] = extra[campo];
      }
    }

    indexar(base);
  };

  for (const activo of origenAf) {
    activos.push(activo);
    indexar(activo);
  }

  for (const activo of origenCodigo) {
    const clave = activo.cb23 ?? '';
    const serie = soloSerie(activo.numeroSerie);
    const destino = porCb23.get(clave) ?? (serie ? porSerie.get(serie) : undefined);

    if (destino && destino !== activo) {
      fusionar(destino, activo);
      fusiones += 1;
      continue;
    }

    const yaExiste =
      (clave !== '' && porCb23.has(clave)) || (serie !== null && porSerie.has(serie));

    if (yaExiste) {
      duplicados += 1;
      continue;
    }

    activos.push(activo);
    indexar(activo);
  }

  return { activos, fusiones, duplicados };
};

// ---------------------------------------------------------------------------
// Fase 3 - Asignaciones del bloque 1
// ---------------------------------------------------------------------------

interface AsignacionImport {
  usuarioId: string;
  serie: string;
  anioCompra: number | null;
  numeroActivo: string | null;
  nombreEquipo: string | null;
  bitlocker: string | null;
  observacion: string | null;
}

const leerAsignaciones = (
  hoja: ExcelJS.Worksheet,
  usuarios: Map<string, string>
): { filas: AsignacionImport[]; ignoradas: string[] } => {
  const filas: AsignacionImport[] = [];
  const ignoradas: string[] = [];
  let finDeBloque = false;

  hoja.eachRow({ includeEmpty: false }, (fila, numero) => {
    if (finDeBloque) return;
    if (numero === 1) return;
    const celdas = fila.values as unknown[];
    const col = (indice: number): string => texto(celda(celdas, indice));

    if (col(1) === 'CODIGO') {
      finDeBloque = true;
      return;
    }

    const serie = soloSerie(col(5));
    const nombre = col(1);

    if (serie === null && nombre === '') return;
    if (serie === null) {
      ignoradas.push(`${nombre} (sin serie valida)`);
      return;
    }
    if (nombre === '') {
      ignoradas.push(`serie ${serie} (sin responsable)`);
      return;
    }

    const usuarioId = buscarResponsable(nombre, usuarios);
    if (!usuarioId) {
      ignoradas.push(`${nombre} (usuario no encontrado)`);
      return;
    }

    filas.push({
      usuarioId,
      serie,
      anioCompra: soloNumero(col(6)),
      numeroActivo: opcional(col(7)),
      nombreEquipo: opcional(col(8)),
      bitlocker: opcional(col(10)),
      observacion: opcional(col(9)),
    });
  });

  return { filas, ignoradas };
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const main = async (): Promise<void> => {
  console.log(`Leyendo ${RUTA_EXCEL}`);
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(RUTA_EXCEL);

  const hojaUsuarios = libro.getWorksheet('Tabla_Usuarios');
  const hojaActivos = libro.getWorksheet('Tabla_Activos');
  const hojaAsignaciones = libro.getWorksheet('Tabla_AsignacionComputo');

  if (!hojaUsuarios || !hojaActivos || !hojaAsignaciones) {
    throw new Error('Faltan hojas requeridas en el Excel');
  }

  // 1. Usuarios y catalogos
  const usuarios = leerUsuarios(hojaUsuarios);
  const catalogos = await importarCatalogos(usuarios);
  const usuariosPorNombre = await importarUsuarios(usuarios, catalogos);
  console.log(
    `Usuarios: ${usuarios.length} leidos, ${usuariosPorNombre.size} en catalogo de nombres`
  );

  // 2. Activos
  const origenAf = leerActivosAF(hojaActivos, usuariosPorNombre);
  const origenCodigo = leerActivosCodigo(hojaAsignaciones, usuariosPorNombre);
  const { activos, fusiones, duplicados } = unificarActivos(
    origenAf.filas,
    origenCodigo
  );

  console.log(
    `Activos AF: ${origenAf.filas.length} (datos ${origenAf.conDatos}, corridos ${origenAf.desplazadas}, vacios ${origenAf.vacias})`
  );
  console.log(
    `Activos CODIGO: ${origenCodigo.length} -> fusionados ${fusiones}, duplicados ${duplicados}`
  );
  console.log(`Activos totales a insertar: ${activos.length}`);

  await prisma.$transaction([
    prisma.asignacionComputo.deleteMany(),
    prisma.activo.deleteMany(),
  ]);

  await prisma.activo.createMany({
    data: activos.map((activo) => ({
      claveActivo: activo.claveActivo,
      cb23: activo.cb23,
      tipo: activo.tipo,
      marca: activo.marca,
      modelo: activo.modelo,
      numeroParte: activo.numeroParte,
      numeroSerie: activo.numeroSerie,
      sucursal: activo.sucursal,
      anydesk: activo.anydesk,
      nombreRed: activo.nombreRed,
      procesador: activo.procesador,
      memoria: activo.memoria,
      estado: 'EN_USO' as const,
      estadoGeneral: activo.estadoGeneral,
      notas: activo.notas,
      responsableId: activo.responsableId,
    })),
  });

  // 3. Asignaciones
  const creados = await prisma.activo.findMany({
    select: { id: true, numeroSerie: true, claveActivo: true },
  });
  const activosPorSerie = new Map<string, number>();
  for (const activo of creados) {
    const serie = soloSerie(activo.numeroSerie);
    if (serie) activosPorSerie.set(serie, activo.id);
  }

  const { filas: asignaciones, ignoradas } = leerAsignaciones(
    hojaAsignaciones,
    usuariosPorNombre
  );

  let insertadas = 0;
  const sinActivo: string[] = [];

  for (const asignacion of asignaciones) {
    const activoId = activosPorSerie.get(asignacion.serie);
    if (!activoId) {
      sinActivo.push(asignacion.serie);
      continue;
    }

    await prisma.asignacionComputo.create({
      data: {
        usuarioId: asignacion.usuarioId,
        activoId,
        anioCompra: asignacion.anioCompra,
        numeroActivo: asignacion.numeroActivo,
        nombreEquipo: asignacion.nombreEquipo,
        bitlocker: asignacion.bitlocker,
        observacion: asignacion.observacion,
        activa: true,
      },
    });
    insertadas += 1;
  }

  console.log(`Asignaciones insertadas: ${insertadas}`);
  if (ignoradas.length > 0) {
    console.log(`Asignaciones ignoradas: ${ignoradas.join(' ; ')}`);
  }
  if (sinActivo.length > 0) {
    console.log(`Asignaciones sin activo para la serie: ${sinActivo.join(', ')}`);
  }

  const sinResponsable = new Map<string, number>();
  for (const activo of activos) {
    if (activo.responsableId) continue;
    const nombre = activo.fuente === 'AF' ? activo.claveActivo : activo.cb23;
    sinResponsable.set(nombre ?? '?', (sinResponsable.get(nombre ?? '?') ?? 0) + 1);
  }
  console.log(
    `Activos sin responsable: ${sinResponsable.size} (etiquetas o nombres sin match)`
  );
};

main()
  .catch((error: unknown) => {
    console.error('[importarInventario] fallo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
