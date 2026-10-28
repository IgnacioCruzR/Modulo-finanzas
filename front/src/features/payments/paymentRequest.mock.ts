import type { AccountOption } from './paymentRequest.types';

// Cuentas de ejemplo con la forma de GET /cuentas-cobrar y /cuentas-pagar.
// Se reemplazarán por la respuesta de la API cuando el formulario se conecte.
export const demoAccounts: AccountOption[] = [
  { id: 1, kind: 'cobrar', originReference: 'Venta #101', counterparty: 'Cliente 20 · Jugueterías del Sur', totalAmount: 150000, outstandingBalance: 150000, dueDate: '2026-11-25', status: 'pendiente' },
  { id: 2, kind: 'cobrar', originReference: 'Venta #102', counterparty: 'Cliente 21 · Mundo Bloques Ltda.', totalAmount: 480000, outstandingBalance: 230000, dueDate: '2026-11-10', status: 'parcial' },
  { id: 3, kind: 'cobrar', originReference: 'Venta #099', counterparty: 'Cliente 18 · Kids Store SpA', totalAmount: 95000, outstandingBalance: 0, dueDate: '2026-10-01', status: 'pagada' },
  { id: 1, kind: 'pagar', originReference: 'OC #75', counterparty: 'Proveedor 12 · Plásticos Andinos S.A.', totalAmount: 300000, outstandingBalance: 300000, dueDate: '2026-11-25', status: 'pendiente' },
  { id: 2, kind: 'pagar', originReference: 'OC #76', counterparty: 'Proveedor 14 · Logística Austral SpA', totalAmount: 820000, outstandingBalance: 120000, dueDate: '2026-10-20', status: 'parcial' },
  { id: 3, kind: 'pagar', originReference: 'OC #70', counterparty: 'Proveedor 09 · Cartones del Valle', totalAmount: 60000, outstandingBalance: 60000, dueDate: '2026-09-30', status: 'anulada' },
];
