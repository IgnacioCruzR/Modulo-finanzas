export type PaymentOrigin = 'PROVEEDOR' | 'NOMINA';
export type ObligationStatus = 'PENDIENTE' | 'PARCIAL';

export interface PaymentObligation {
  id: number;
  code: string;
  origin: PaymentOrigin;
  beneficiary: string;
  originalAmount: number;
  outstandingBalance: number;
  dueDate: string;
  status: ObligationStatus;
}

export interface PaymentRecord {
  id: string;
  obligationId: number;
  obligationCode: string;
  origin: PaymentOrigin;
  beneficiary: string;
  amount: number;
  paymentDate: string;
  method: string;
  bankReference: string | null;
  notes: string | null;
  createdAt: string;
  originalAmount?: number;
  balanceBeforePayment?: number;
  balanceAfterPayment?: number;
}

export interface PaymentSummary {
  pendingObligations: number;
  paidThisMonth: number;
  overdueObligations: number;
}

export interface CreatePaymentInput {
  obligationId: number;
  amount: number;
  paymentDate: string;
  method: string;
  bankReference: string | null;
  notes: string | null;
}

export interface PaymentDetails extends PaymentRecord {
  originalAmount: number;
  balanceBeforePayment: number;
  balanceAfterPayment: number;
}

export type PaymentsMode = 'demo' | 'api';
