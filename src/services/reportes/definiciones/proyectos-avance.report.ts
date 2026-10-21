import {
  EstadoProyecto,
  Prioridad,
  Prisma,
} from '../../../generated/prisma/client';
import { prisma } from '../../../config/prisma';
import { HttpError } from '../../../middlewares/error.middleware';
import {
  ReporteDefinicion,
  ReporteDocumento,
} from '../../../models/reporte.model';
import { calcularResumenTareas } from '../../../utils/proyecto-progreso';
import {
  filtroProyectosVisibles,
  puedeVerTodosProyectos,
} from '../../../utils/proyecto-visibilidad';
import {
  comoEntero,
  comoFecha,
  validarOpcion,
} from '../../../utils/validacion';

const MAX_FILAS = 5000;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const textoOpcional = (valor: unknown): string | undefined => {
  if (typeof valor !== 'string') return undefined;
  const texto = valor.trim();
  return texto || undefined;
};

const leerFechaLimite = (
  valor: unknown,
  campo: string,
  finDia: boolean
): Date | undefined => {
  if (valor === undefined) return undefined;
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto === '') return undefined;
  const fecha = comoFecha(texto, campo);
  if (!fecha) return undefined;
  if (finDia && /^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return new Date(fecha.getTime() + MILISEGUNDOS_POR_DIA - 1);
  }
  return fecha;
};

const validarFiltros = (
  query: Record<string, unknown>
): Record<string, unknown> => {
  const estado = validarOpcion(
    query.estado,
    'estado',
    Object.values(EstadoProyecto)
  ) as EstadoProyecto | undefined;
  const prioridad = validarOpcion(
    query.prioridad,
    'prioridad',
    Object.values(Prioridad)
  ) as Prioridad | undefined;
  const activoTexto = validarOpcion(query.activo, 'activo', ['true', 'false']);
  const activo = activoTexto === undefined ? true : activoTexto === 'true';
  const departamentoId = comoEntero(query.departamentoId, 'departamentoId', 0);
  if (departamentoId < 0) {
    throw new HttpError(
      400,
      'El parámetro "departamentoId" debe ser positivo',
      [{ campo: 'departamentoId', valor: String(departamentoId) }]
    );
  }

  const desde = leerFechaLimite(query.desde, 'desde', false);
  const hasta = leerFechaLimite(query.hasta, 'hasta', true);
  if (desde && hasta && desde.getTime() > hasta.getTime()) {
    throw new HttpError(400, '"desde" no puede ser posterior a "hasta"', [
      { campo: 'desde', valor: desde.toISOString() },
      { campo: 'hasta', valor: hasta.toISOString() },
    ]);
  }

  return {
    estado,
    prioridad,
    activo,
    responsableId: textoOpcional(query.responsableId),
    departamentoId: departamentoId > 0 ? departamentoId : undefined,
    desde,
    hasta,
    q: textoOpcional(query.q),
  };
};

const documentoVacio = (metadatos: Record<string, string>): ReporteDocumento => ({
  titulo: 'Reporte de proyectos: avance, hitos y horas',
  subtitulo: 'Total de proyectos: 0',
  generadoEn: new Date(),
  generadoPor: 'Sistema',
  metadatos: { 'Registros exportados': '0', ...metadatos },
  secciones: [
    {
      nombre: 'Resumen',
      columnas: [
        { clave: 'proyectos', encabezado: 'Proyectos', ancho: 12 },
        { clave: 'avancePromedio', encabezado: 'Avance promedio %', ancho: 18 },
        { clave: 'tareasTotales', encabezado: 'Tareas totales', ancho: 16 },
        { clave: 'tareasCompletadas', encabezado: 'Tareas completadas', ancho: 20 },
        { clave: 'hitosTotales', encabezado: 'Hitos totales', ancho: 16 },
        { clave: 'hitosCompletados', encabezado: 'Hitos completados', ancho: 20 },
        { clave: 'horasTotales', encabezado: 'Horas registradas', ancho: 18 },
        { clave: 'presupuestoTotal', encabezado: 'Presupuesto total', ancho: 18 },
      ],
      filas: [
        {
          proyectos: 0,
          avancePromedio: 0,
          tareasTotales: 0,
          tareasCompletadas: 0,
          hitosTotales: 0,
          hitosCompletados: 0,
          horasTotales: 0,
          presupuestoTotal: 0,
        },
      ],
    },
    {
      nombre: 'Proyectos',
      columnas: [
        { clave: 'codigo', encabezado: 'Código', ancho: 14 },
        { clave: 'nombre', encabezado: 'Proyecto', ancho: 34 },
        { clave: 'estado', encabezado: 'Estado', ancho: 18 },
        { clave: 'prioridad', encabezado: 'Prioridad', ancho: 14 },
        { clave: 'responsable', encabezado: 'Responsable', ancho: 28 },
        { clave: 'departamento', encabezado: 'Departamento', ancho: 22 },
        { clave: 'fechaInicio', encabezado: 'Inicio', ancho: 18 },
        { clave: 'fechaFinPlanificada', encabezado: 'Fin planificado', ancho: 18 },
        { clave: 'progreso', encabezado: 'Avance %', ancho: 12 },
        { clave: 'tareasTotales', encabezado: 'Tareas totales', ancho: 16 },
        { clave: 'tareasCompletadas', encabezado: 'Tareas completadas', ancho: 20 },
        { clave: 'subtareasTotales', encabezado: 'Subtareas totales', ancho: 18 },
        { clave: 'subtareasCompletadas', encabezado: 'Subtareas completadas', ancho: 22 },
        { clave: 'hitosTotales', encabezado: 'Hitos totales', ancho: 16 },
        { clave: 'hitosCompletados', encabezado: 'Hitos completados', ancho: 20 },
        { clave: 'proximoHito', encabezado: 'Próximo hito', ancho: 30 },
        { clave: 'fechaProximoHito', encabezado: 'Fecha próximo hito', ancho: 20 },
        { clave: 'horasRegistradas', encabezado: 'Horas registradas', ancho: 18 },
        { clave: 'presupuesto', encabezado: 'Presupuesto', ancho: 18 },
      ],
      filas: [],
    },
    {
      nombre: 'Hitos',
      columnas: [
        { clave: 'proyectoCodigo', encabezado: 'Código proyecto', ancho: 16 },
        { clave: 'proyectoNombre', encabezado: 'Proyecto', ancho: 34 },
        { clave: 'titulo', encabezado: 'Hito', ancho: 34 },
        { clave: 'estado', encabezado: 'Estado', ancho: 18 },
        { clave: 'fechaPlanificada', encabezado: 'Fecha planificada', ancho: 20 },
        { clave: 'fechaCompletada', encabezado: 'Fecha completada', ancho: 20 },
      ],
      filas: [],
    },
  ],
});

const cargarProyectos = async (
  filtros: Record<string, unknown>,
  usuario: { id: string; nombre: string; email: string | null }
): Promise<ReporteDocumento> => {
  const estado = filtros.estado as EstadoProyecto | undefined;
  const prioridad = filtros.prioridad as Prioridad | undefined;
  const activo = filtros.activo as boolean;
  const responsableId = filtros.responsableId as string | undefined;
  const departamentoId = filtros.departamentoId as number | undefined;
  const desde = filtros.desde as Date | undefined;
  const hasta = filtros.hasta as Date | undefined;
  const q = filtros.q as string | undefined;
  const verTodos = await puedeVerTodosProyectos(usuario.id);

  if (!verTodos && !activo) {
    return documentoVacio({
      Visibilidad: 'Solo proyectos visibles para el usuario',
      Estado: estado ?? 'Todos',
      Prioridad: prioridad ?? 'Todas',
    });
  }

  const where: Prisma.ProyectoWhereInput = {
    ...(verTodos ? { activo } : { activo: true }),
    ...filtroProyectosVisibles(usuario.id, verTodos),
    ...(estado ? { estado } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(responsableId ? { responsableId } : {}),
    ...(departamentoId ? { departamentoId } : {}),
    ...(desde || hasta
      ? {
          fechaFinPlanificada: {
            ...(desde ? { gte: desde } : {}),
            ...(hasta ? { lte: hasta } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { codigo: { contains: q } },
            { nombre: { contains: q } },
          ],
        }
      : {}),
  };

  const [proyectos, total] = await Promise.all([
    prisma.proyecto.findMany({
      where,
      orderBy: [{ fechaFinPlanificada: 'asc' }, { id: 'asc' }],
      take: MAX_FILAS,
      select: {
        id: true,
        codigo: true,
        nombre: true,
        estado: true,
        prioridad: true,
        fechaInicio: true,
        fechaFinPlanificada: true,
        fechaFinReal: true,
        presupuesto: true,
        responsable: { select: { id: true, nombre: true, email: true } },
        departamento: { select: { id: true, nombre: true } },
        tareas: {
          where: { activo: true },
          select: { id: true, parentId: true, estado: true },
        },
        hitos: {
          where: { activo: true },
          orderBy: [{ fechaPlanificada: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            titulo: true,
            estado: true,
            fechaPlanificada: true,
            fechaCompletada: true,
          },
        },
      },
    }),
    prisma.proyecto.count({ where }),
  ]);

  if (total > MAX_FILAS) {
    throw new HttpError(
      400,
      `El reporte supera el límite de ${MAX_FILAS} proyectos; aplica más filtros`
    );
  }

  const ids = proyectos.map((proyecto) => proyecto.id);
  const horas = ids.length
    ? await prisma.proyectoRegistroHoras.groupBy({
        by: ['proyectoId'],
        where: { proyectoId: { in: ids }, activo: true },
        _sum: { horas: true },
      })
    : [];
  const horasPorProyecto = new Map(
    horas.map((fila) => [
      fila.proyectoId,
      fila._sum.horas === null ? 0 : Number(fila._sum.horas),
    ])
  );

  const filasProyectos: Record<string, unknown>[] = [];
  const filasHitos: Record<string, unknown>[] = [];
  let sumaAvance = 0;
  let tareasTotales = 0;
  let tareasCompletadas = 0;
  let hitosTotales = 0;
  let hitosCompletados = 0;
  let horasTotales = 0;
  let presupuestoTotal = 0;

  for (const proyecto of proyectos) {
    const subtareas = new Map<number, { estado: (typeof proyecto.tareas)[number]['estado'] }[]>();
    for (const tarea of proyecto.tareas) {
      if (tarea.parentId === null) continue;
      const lista = subtareas.get(tarea.parentId) ?? [];
      lista.push({ estado: tarea.estado });
      subtareas.set(tarea.parentId, lista);
    }

    const progreso = calcularResumenTareas(
      proyecto.tareas
        .filter((tarea) => tarea.parentId === null)
        .map((tarea) => ({
          estado: tarea.estado,
          subtareas: subtareas.get(tarea.id) ?? [],
        }))
    );

    const hitosProyecto = proyecto.hitos;
    const hitosCompletadosProyecto = hitosProyecto.filter(
      (hito) => hito.estado === 'COMPLETADO'
    ).length;
    const proximoHito = hitosProyecto.find(
      (hito) => hito.estado === 'PENDIENTE'
    );
    const horasProyecto = horasPorProyecto.get(proyecto.id) ?? 0;
    const presupuesto =
      proyecto.presupuesto === null ? null : Number(proyecto.presupuesto);

    sumaAvance += progreso.progreso;
    tareasTotales += progreso.resumenTareas.total;
    tareasCompletadas += progreso.resumenTareas.completadas;
    hitosTotales += hitosProyecto.length;
    hitosCompletados += hitosCompletadosProyecto;
    horasTotales += horasProyecto;
    presupuestoTotal += presupuesto ?? 0;

    filasProyectos.push({
      codigo: proyecto.codigo,
      nombre: proyecto.nombre,
      estado: proyecto.estado,
      prioridad: proyecto.prioridad,
      responsable: proyecto.responsable.nombre,
      departamento: proyecto.departamento?.nombre ?? null,
      fechaInicio: proyecto.fechaInicio,
      fechaFinPlanificada: proyecto.fechaFinPlanificada,
      progreso: progreso.progreso,
      tareasTotales: progreso.resumenTareas.total,
      tareasCompletadas: progreso.resumenTareas.completadas,
      subtareasTotales: progreso.resumenTareas.subtareasTotal,
      subtareasCompletadas: progreso.resumenTareas.subtareasCompletadas,
      hitosTotales: hitosProyecto.length,
      hitosCompletados: hitosCompletadosProyecto,
      proximoHito: proximoHito?.titulo ?? null,
      fechaProximoHito: proximoHito?.fechaPlanificada ?? null,
      horasRegistradas: horasProyecto,
      presupuesto,
    });

    for (const hito of hitosProyecto) {
      filasHitos.push({
        proyectoCodigo: proyecto.codigo,
        proyectoNombre: proyecto.nombre,
        titulo: hito.titulo,
        estado: hito.estado,
        fechaPlanificada: hito.fechaPlanificada,
        fechaCompletada: hito.fechaCompletada,
      });
    }
  }

  if (filasHitos.length > MAX_FILAS * 2) {
    throw new HttpError(
      400,
      'El reporte contiene demasiados hitos; aplica más filtros'
    );
  }

  const metadatos: Record<string, string> = {
    Visibilidad: verTodos ? 'Todos los proyectos' : 'Solo proyectos visibles',
    Estado: estado ?? 'Todos',
    Prioridad: prioridad ?? 'Todas',
    Responsable: responsableId ?? 'Todos',
    Departamento: departamentoId ? String(departamentoId) : 'Todos',
    Periodo: desde || hasta
      ? `${desde?.toISOString() ?? 'inicio'} a ${hasta?.toISOString() ?? 'fin'}`
      : 'Sin filtro de fechas',
    Búsqueda: q ?? 'Sin búsqueda',
    'Registros exportados': String(proyectos.length),
  };

  const documento = documentoVacio(metadatos);
  documento.subtitulo = `Total de proyectos: ${total}`;
  documento.generadoEn = new Date();
  documento.generadoPor = usuario.nombre;
  documento.secciones[0].filas = [
    {
      proyectos: total,
      avancePromedio: total === 0 ? 0 : Math.round(sumaAvance / total),
      tareasTotales,
      tareasCompletadas,
      hitosTotales,
      hitosCompletados,
      horasTotales,
      presupuestoTotal,
    },
  ];
  documento.secciones[1].filas = filasProyectos;
  documento.secciones[2].filas = filasHitos;

  return documento;
};

export const proyectosAvanceReporte: ReporteDefinicion = {
  codigo: 'proyectos-avance',
  nombre: 'Proyectos: avance, hitos y horas',
  descripcion:
    'Proyectos visibles con estado, avance por tareas/subtareas, hitos y horas registradas.',
  modulo: 'Proyectos',
  formatos: ['xlsx', 'csv', 'pdf'],
  permisos: ['proyectos:leer'],
  filtros: [
    {
      nombre: 'estado',
      tipo: 'enum',
      descripcion: 'Estado del proyecto.',
      opciones: Object.values(EstadoProyecto),
    },
    {
      nombre: 'prioridad',
      tipo: 'enum',
      descripcion: 'Prioridad del proyecto.',
      opciones: Object.values(Prioridad),
    },
    {
      nombre: 'activo',
      tipo: 'booleano',
      descripcion: 'Incluye proyectos activos o inactivos. Default true.',
    },
    {
      nombre: 'responsableId',
      tipo: 'texto',
      descripcion: 'ID del responsable.',
    },
    {
      nombre: 'departamentoId',
      tipo: 'texto',
      descripcion: 'ID del departamento.',
    },
    {
      nombre: 'desde',
      tipo: 'fecha',
      descripcion: 'Fecha inicial de fin planificado.',
    },
    {
      nombre: 'hasta',
      tipo: 'fecha',
      descripcion: 'Fecha final de fin planificado.',
    },
    {
      nombre: 'q',
      tipo: 'texto',
      descripcion: 'Busca en código o nombre del proyecto.',
    },
  ],
  maxFilas: MAX_FILAS,
  validarFiltros,
  cargar: cargarProyectos,
};
