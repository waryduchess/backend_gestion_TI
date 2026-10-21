import { EstadoTarea } from '../generated/prisma/client';
import { ProgresoProyecto } from '../models/proyecto.model';

interface TareaProgreso {
  estado: EstadoTarea;
  subtareas: { estado: EstadoTarea }[];
}

export const calcularResumenTareas = (
  tareas: TareaProgreso[]
): ProgresoProyecto => {
  let total = 0;
  let completadas = 0;
  let pendientes = 0;
  let enProgreso = 0;
  let canceladas = 0;
  let subtareasTotal = 0;
  let subtareasCompletadas = 0;

  for (const tarea of tareas) {
    subtareasTotal += tarea.subtareas.length;
    subtareasCompletadas += tarea.subtareas.filter(
      (subtarea) => subtarea.estado === EstadoTarea.COMPLETADA
    ).length;

    const unidades =
      tarea.subtareas.length > 0
        ? tarea.subtareas
        : [{ estado: tarea.estado }];

    for (const unidad of unidades) {
      total += 1;
      if (unidad.estado === EstadoTarea.COMPLETADA) completadas += 1;
      else if (unidad.estado === EstadoTarea.EN_PROGRESO) enProgreso += 1;
      else if (unidad.estado === EstadoTarea.CANCELADA) canceladas += 1;
      else pendientes += 1;
    }
  }

  const denominador = Math.max(1, total - canceladas);
  return {
    progreso:
      total === 0
        ? 0
        : Math.min(100, Math.round((completadas / denominador) * 100)),
    resumenTareas: {
      total,
      completadas,
      pendientes,
      enProgreso,
      canceladas,
      subtareasTotal,
      subtareasCompletadas,
    },
  };
};
