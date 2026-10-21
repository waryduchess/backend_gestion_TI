import { inventarioGeneralReporte } from './definiciones/inventario-general.report';
import { licenciasVigenciaReporte } from './definiciones/licencias-vigencia.report';
import { mantenimientosPeriodoReporte } from './definiciones/mantenimientos-periodo.report';
import { proyectosAvanceReporte } from './definiciones/proyectos-avance.report';
import { incidenciasPeriodoReporte } from './definiciones/incidencias-periodo.report';
import { auditoriaPeriodoReporte } from './definiciones/auditoria-periodo.report';
import { usuariosPermisosReporte } from './definiciones/usuarios-permisos.report';
import { ejecutivoMensualReporte } from './definiciones/ejecutivo-mensual.report';
import { registrarReporte } from './reporte.registry';

registrarReporte(inventarioGeneralReporte);
registrarReporte(licenciasVigenciaReporte);
registrarReporte(mantenimientosPeriodoReporte);
registrarReporte(proyectosAvanceReporte);
registrarReporte(incidenciasPeriodoReporte);
registrarReporte(auditoriaPeriodoReporte);
registrarReporte(usuariosPermisosReporte);
registrarReporte(ejecutivoMensualReporte);

export {
  listarDefinicionesReportes,
  mapearMetadataReporte,
  obtenerDefinicionReporte,
} from './reporte.registry';
