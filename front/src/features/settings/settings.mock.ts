export type SettingsSection = 'general' | 'users' | 'integrations';
export type DemoRole = 'Administrador de Finanzas' | 'Analista';

export interface GeneralPreferences {
  currency: string;
  dateFormat: string;
  timezone: string;
  pageSize: string;
}

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: DemoRole;
  active: boolean;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  description: string;
  data: string[];
  status: 'Pendiente de integración' | 'Demostración';
  pending: string[];
}

export const initialPreferences: GeneralPreferences = {
  currency: 'CLP',
  dateFormat: 'DD/MM/AAAA',
  timezone: 'America/Santiago',
  pageSize: '25',
};

export const permissionDefinitions: PermissionDefinition[] = [
  { id: 'dashboard', label: 'Consultar Dashboard', description: 'Ver indicadores y resumen financiero.' },
  { id: 'movements', label: 'Consultar movimientos', description: 'Consultar movimientos e historial financiero.' },
  { id: 'register', label: 'Registrar movimientos', description: 'Registrar pagos y operaciones financieras.' },
  { id: 'view-reports', label: 'Consultar informes', description: 'Ver informes financieros emitidos.' },
  { id: 'generate-reports', label: 'Generar informes', description: 'Configurar y simular la emisión de informes.' },
  { id: 'settings', label: 'Acceder a configuraciones', description: 'Consultar parámetros y permisos del módulo.' },
];

export const demoUsers: DemoUser[] = [
  { id: 'u-101', name: 'Ignacio Cruz', email: 'ignacio.cruz@lesgo.demo', role: 'Administrador de Finanzas', active: true },
  { id: 'u-102', name: 'Camila Rojas', email: 'camila.rojas@lesgo.demo', role: 'Analista', active: true },
  { id: 'u-103', name: 'Matías Soto', email: 'matias.soto@lesgo.demo', role: 'Analista', active: true },
  { id: 'u-104', name: 'Valentina Pérez', email: 'valentina.perez@lesgo.demo', role: 'Analista', active: false },
];

export const initialRolePermissions: Record<DemoRole, string[]> = {
  'Administrador de Finanzas': permissionDefinitions.map((item) => item.id),
  Analista: ['dashboard', 'movements', 'view-reports'],
};

export const integrations: IntegrationDefinition[] = [
  {
    id: 'sales',
    name: 'Ventas',
    description: 'Información comercial para el seguimiento de ingresos y saldos de clientes.',
    data: ['Pedidos', 'Ingresos derivados de ventas', 'Cuentas por cobrar'],
    status: 'Pendiente de integración',
    pending: ['Definir contrato de datos de ventas', 'Habilitar servicio del módulo de Ventas', 'Acordar sincronización y responsables'],
  },
  {
    id: 'purchases',
    name: 'Compras',
    description: 'Obligaciones con proveedores y documentos originados en el proceso de compras.',
    data: ['Órdenes de compra', 'Proveedores', 'Obligaciones y cuentas por pagar'],
    status: 'Pendiente de integración',
    pending: ['Definir identificadores de obligaciones', 'Habilitar servicio del módulo de Compras', 'Acordar actualización de saldos'],
  },
  {
    id: 'human-resources',
    name: 'Recursos Humanos',
    description: 'Datos de empleados y movimientos financieros relacionados con nómina.',
    data: ['Empleados', 'Períodos de nómina', 'Obligaciones y movimientos de nómina'],
    status: 'Demostración',
    pending: ['Acordar datos mínimos de nómina', 'Definir controles de privacidad', 'Habilitar conexión autenticada entre módulos'],
  },
];
