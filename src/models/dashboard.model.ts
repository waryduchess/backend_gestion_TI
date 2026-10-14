import { UsuarioResumen } from './comun.model';

export type SucursalDashboard = 'CANCUN' | 'PLAYA';

export interface KpisDashboard {
  ticketsPendientes: number;
  totalActivos: number;
  equiposAsignados: number;
}

export interface ActivoPorTipo {
  tipo: string;
  total: number;
}

export interface LicenciaPorVencer {
  id: number;
  software: string;
  proveedor: string | null;
  fechaVencimiento: Date;
  asignadaA: UsuarioResumen | null;
}

export interface ResumenDashboard {
  kpis: KpisDashboard;
  activosPorTipo: ActivoPorTipo[];
  licenciasPorVencer: LicenciaPorVencer[];
  recordatorios: never[];
}
