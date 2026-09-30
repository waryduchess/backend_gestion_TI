import { prisma } from '../config/prisma';
import { Catalogos } from '../models/catalogo.model';

export const obtenerCatalogos = async (): Promise<Catalogos> => {
  const [departamentos, ubicaciones, puestos, tiposUsuario, roles] =
    await Promise.all([
      prisma.departamento.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.ubicacion.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.puesto.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.tipoUsuario.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.rol.findMany({
        where: { activo: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

  return {
    departamentos,
    ubicaciones,
    puestos,
    tiposUsuario,
    roles,
  };
};
