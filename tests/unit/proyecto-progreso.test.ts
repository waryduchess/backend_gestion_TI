import { EstadoTarea } from '../../src/generated/prisma/client';
import { calcularResumenTareas } from '../../src/utils/proyecto-progreso';

describe('calculo de progreso de proyectos', () => {
  it('devuelve progreso 0 cuando no hay tareas', () => {
    expect(calcularResumenTareas([])).toEqual({
      progreso: 0,
      resumenTareas: {
        total: 0,
        completadas: 0,
        pendientes: 0,
        enProgreso: 0,
        canceladas: 0,
        subtareasTotal: 0,
        subtareasCompletadas: 0,
      },
    });
  });

  it('calcula el progreso usando subtareas cuando existen', () => {
    const resultado = calcularResumenTareas([
      { estado: EstadoTarea.COMPLETADA, subtareas: [] },
      {
        estado: EstadoTarea.PENDIENTE,
        subtareas: [
          { estado: EstadoTarea.COMPLETADA },
          { estado: EstadoTarea.EN_PROGRESO },
        ],
      },
      { estado: EstadoTarea.CANCELADA, subtareas: [] },
    ]);

    expect(resultado.progreso).toBe(67);
    expect(resultado.resumenTareas).toEqual({
      total: 4,
      completadas: 2,
      pendientes: 0,
      enProgreso: 1,
      canceladas: 1,
      subtareasTotal: 2,
      subtareasCompletadas: 1,
    });
  });

  it('ignora las tareas canceladas en el denominador', () => {
    const resultado = calcularResumenTareas([
      { estado: EstadoTarea.CANCELADA, subtareas: [] },
      { estado: EstadoTarea.COMPLETADA, subtareas: [] },
    ]);

    expect(resultado.progreso).toBe(100);
  });

  it('devuelve 0 si todas las tareas estan canceladas', () => {
    const resultado = calcularResumenTareas([
      { estado: EstadoTarea.CANCELADA, subtareas: [] },
      { estado: EstadoTarea.CANCELADA, subtareas: [] },
    ]);

    expect(resultado.progreso).toBe(0);
    expect(resultado.resumenTareas.canceladas).toBe(2);
  });
});
