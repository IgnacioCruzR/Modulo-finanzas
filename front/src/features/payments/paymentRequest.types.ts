// Contrato de POST /api/finanzas/pagos (CrearPagoDto en back/Finanzas/v2/finanzas-v2.dto.ts).
export const operationTypes = ['cobro', 'proveedor', 'nomina', 'reembolso'] as const;
export const paymentMethods = ['efectivo', 'transferencia', 'tarjeta', 'simulado'] as const;

export type OperationType = typeof operationTypes[number];
export type PaymentMethod = typeof paymentMethods[number];
export type AccountStatus = 'pendiente' | 'parcial' | 'pagada' | 'anulada';

export interface CreatePaymentRequestPayload {
  tipo_operacion: OperationType;
  monto: number;
  metodo_pago: PaymentMethod;
  id_cxc?: number;
  id_cxp?: number;
  id_empleado?: number;
  id_nomina?: number;
  id_reembolso?: number;
  descripcion?: string;
}

/** Vista resumida de una cuenta por cobrar o por pagar, como la devuelve la API v2. */
export interface AccountOption {
  id: number;
  kind: 'cobrar' | 'pagar';
  originReference: string;
  counterparty: string;
  totalAmount: number;
  outstandingBalance: number;
  dueDate: string;
  status: AccountStatus;
}

/** Valores del formulario tal como los escribe la persona (texto sin convertir). */
export interface PaymentRequestFormValues {
  operationType: OperationType | '';
  accountId: string;
  payrollId: string;
  employeeId: string;
  refundId: string;
  amount: string;
  method: PaymentMethod | '';
  description: string;
  confirmed: boolean;
}

export type PaymentRequestField = keyof PaymentRequestFormValues;
export type PaymentRequestErrors = Partial<Record<PaymentRequestField, string>>;
