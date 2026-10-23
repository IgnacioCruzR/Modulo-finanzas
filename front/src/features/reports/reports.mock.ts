export type ReportCategory = 'Financiero' | 'Contable' | 'Tributario';
export type ReportFormat = 'PDF' | 'Excel';
export type ReportPeriodicity = 'Mensual' | 'Trimestral' | 'Anual';

export interface ReportDefinition {
  id: string;
  name: string;
  category: ReportCategory;
  preview: 'results' | 'cash-flow' | 'summary' | 'transactions' | 'payables' | 'receivables' | 'tax';
}

export interface ReportHistoryItem {
  id: string;
  reportName: string;
  period: string;
  generatedBy: string;
  generatedAt: string;
  format: ReportFormat;
  simulated: boolean;
  category: ReportCategory;
  fromDate?: string;
  toDate?: string;
  periodicity?: ReportPeriodicity;
}

export const reportDefinitions: ReportDefinition[] = [
  { id: 'income-statement', name: 'Estado de resultados', category: 'Financiero', preview: 'results' },
  { id: 'cash-flow', name: 'Flujo de caja', category: 'Financiero', preview: 'cash-flow' },
  { id: 'income-expense-summary', name: 'Resumen de ingresos y egresos', category: 'Financiero', preview: 'summary' },
  { id: 'movements', name: 'Movimientos financieros', category: 'Contable', preview: 'transactions' },
  { id: 'payables', name: 'Cuentas por pagar', category: 'Contable', preview: 'payables' },
  { id: 'receivables', name: 'Cuentas por cobrar', category: 'Contable', preview: 'receivables' },
  { id: 'tax-summary', name: 'Resumen tributario demostrativo', category: 'Tributario', preview: 'tax' },
  { id: 'tax-transactions', name: 'Operaciones con tratamiento tributario', category: 'Tributario', preview: 'tax' },
];

export const demoMonthlyData = [
  { month: 'May 2026', date: '2026-05-01', income: 120500, expense: 68300, cashIn: 116200, cashOut: 70400 },
  { month: 'Jun 2026', date: '2026-06-01', income: 132210, expense: 70450, cashIn: 128900, cashOut: 72600 },
  { month: 'Jul 2026', date: '2026-07-01', income: 128900, expense: 66800, cashIn: 125100, cashOut: 69100 },
  { month: 'Aug 2026', date: '2026-08-01', income: 141600, expense: 71300, cashIn: 137400, cashOut: 73500 },
  { month: 'Sep 2026', date: '2026-09-01', income: 138420, expense: 69200, cashIn: 134800, cashOut: 71800 },
  { month: 'Oct 2026', date: '2026-10-01', income: 145280, expense: 72150, cashIn: 140900, cashOut: 74600 },
];

export const demoLedgerRows = [
  { date: '03-10-2026', description: 'Venta de productos · canal web', type: 'Ingreso', amount: 48200 },
  { date: '08-10-2026', description: 'Pago a proveedor de inventario', type: 'Egreso', amount: 27600 },
  { date: '12-10-2026', description: 'Venta de productos · tiendas', type: 'Ingreso', amount: 36100 },
  { date: '18-10-2026', description: 'Servicios operativos', type: 'Egreso', amount: 18400 },
  { date: '22-10-2026', description: 'Venta de productos · canal web', type: 'Ingreso', amount: 60980 },
];

export const demoPayableRows = [
  { name: 'Distribuidora Bloques SpA', dueDate: '15-10-2026', amount: 42000, status: 'Pendiente' },
  { name: 'Comercializadora Ideas Ltda.', dueDate: '05-11-2026', amount: 18600, status: 'Pendiente' },
];

export const demoReceivableRows = [
  { name: 'Cliente · pedido web #2041', dueDate: '20-10-2026', amount: 12500, status: 'Por cobrar' },
  { name: 'Cliente · pedido tienda #1978', dueDate: '02-11-2026', amount: 8300, status: 'Por cobrar' },
];

export const initialReportHistory: ReportHistoryItem[] = [
  {
    id: 'R-1001',
    reportName: 'Estado de resultados',
    period: 'Oct 2026',
    generatedBy: 'Ignacio Cruz',
    generatedAt: '23/10/2026 10:24',
    format: 'PDF',
    simulated: false,
    category: 'Financiero',
    fromDate: '2026-10-01',
    toDate: '2026-10-23',
    periodicity: 'Mensual',
  },
  {
    id: 'R-1002',
    reportName: 'Flujo de caja',
    period: 'Sep 2026',
    generatedBy: 'Ignacio Cruz',
    generatedAt: '08/10/2026 15:17',
    format: 'Excel',
    simulated: false,
    category: 'Financiero',
    fromDate: '2026-09-01',
    toDate: '2026-09-30',
    periodicity: 'Mensual',
  },
  {
    id: 'R-1003',
    reportName: 'Cuentas por pagar',
    period: 'Sep 2026',
    generatedBy: 'Administrador',
    generatedAt: '03/10/2026 09:42',
    format: 'PDF',
    simulated: false,
    category: 'Contable',
    fromDate: '2026-09-01',
    toDate: '2026-09-30',
    periodicity: 'Mensual',
  },
];

export const reportCategories: ReportCategory[] = ['Financiero', 'Contable', 'Tributario'];
