import {
  EstadoProyecto,
  Prioridad,
} from '../generated/prisma/client';

export interface KpisProyectos {
  proyectosActivos: number;
  proyectosEnProgreso: number;
  proyectosVencidos: number;
  proyectosProximos7Dias: number;
  proyectosProximos30Dias: number;
  tareasPendientes: number;
  tareasVencidas: number;
  hitosProximos30Dias: number;
  hitosVencidos: number;
  horasRegistradas: number;
}

export interface ProyectoPorEstado {
  estado: EstadoProyecto;
  total: number;
}

export interface ProyectoPorPrioridad {
  prioridad: Prioridad;
  total: number;
}

export interface ProyectoProximoDashboard {
  id: number;
  codigo: string;
  nombre: string;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  fechaFinPlanificada: Date;
}

export interface ResumenProyectosDashboard {
  kpis: KpisProyectos;
  proyectosPorEstado: ProyectoPorEstado[];
  proyectosPorPrioridad: ProyectoPorPrioridad[];
  proyectosProximos: ProyectoProximoDashboard[];
}
