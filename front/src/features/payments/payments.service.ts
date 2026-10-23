import type {
  CreatePaymentInput,
  ObligationStatus,
  PaymentObligation,
  PaymentOrigin,
  PaymentDetails,
  PaymentRecord,
  PaymentSummary,
  PaymentsMode,
} from './payments.types';

interface DemoStore {
  obligations: PaymentObligation[];
  payments: PaymentRecord[];
  idempotency: Record<string, string>;
}

const STORAGE_KEY = 'lesgo.finance.payments.demo.v1';
const configuredMode = import.meta.env.VITE_PAYMENTS_MODE;

if (configuredMode && configuredMode !== 'demo' && configuredMode !== 'api') {
  throw new Error('VITE_PAYMENTS_MODE debe ser "demo" o "api".');
}

export const paymentsMode: PaymentsMode =
  configuredMode ?? (import.meta.env.DEV ? 'demo' : 'api');

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initialDemoStore(): DemoStore {
  const obligations: PaymentObligation[] = [
    { id: 1028, code: 'OC-1028', origin: 'PROVEEDOR', beneficiary: 'Distribuidora Bloques SpA', originalAmount: 1250000, outstandingBalance: 1250000, dueDate: localDate(7), status: 'PENDIENTE' },
    { id: 1029, code: 'OC-1029', origin: 'PROVEEDOR', beneficiary: 'Comercializadora Ideas Ltda.', originalAmount: 850000, outstandingBalance: 850000, dueDate: localDate(-4), status: 'PENDIENTE' },
    { id: 1030, code: 'OC-1030', origin: 'PROVEEDOR', beneficiary: 'Juguetes Creativos S.A.', originalAmount: 2100000, outstandingBalance: 2100000, dueDate: localDate(-5), status: 'PENDIENTE' },
    { id: 1031, code: 'OC-1031', origin: 'PROVEEDOR', beneficiary: 'Logística Andina SpA', originalAmount: 430000, outstandingBalance: 180000, dueDate: localDate(2), status: 'PARCIAL' },
    { id: 2201, code: 'NOM-2201', origin: 'NOMINA', beneficiary: 'Equipo de bodega · semana 42', originalAmount: 1850000, outstandingBalance: 1850000, dueDate: localDate(3), status: 'PENDIENTE' },
    { id: 2202, code: 'NOM-2202', origin: 'NOMINA', beneficiary: 'Equipo de ventas · semana 42', originalAmount: 2240000, outstandingBalance: 2240000, dueDate: localDate(-2), status: 'PENDIENTE' },
  ];
  const payments: PaymentRecord[] = [
    {
      id: 'P-1001',
      obligationId: 1028,
      obligationCode: 'OC-1028',
      origin: 'PROVEEDOR',
      beneficiary: 'Distribuidora Bloques SpA',
      amount: 1250000,
      paymentDate: localDate(-8),
      method: 'Transferencia bancaria',
      bankReference: 'TRX-000128',
      notes: 'Pago de demostración',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'P-1002',
      obligationId: 1029,
      obligationCode: 'OC-1029',
      origin: 'PROVEEDOR',
      beneficiary: 'Comercializadora Ideas Ltda.',
      amount: 850000,
      paymentDate: localDate(-3),
      method: 'Transferencia bancaria',
      bankReference: 'TRX-000129',
      notes: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'P-1003',
      obligationId: 2201,
      obligationCode: 'NOM-2201',
      origin: 'NOMINA',
      beneficiary: 'Equipo de bodega · semana 42',
      amount: 2100000,
      paymentDate: localDate(-1),
      method: 'Transferencia bancaria',
      bankReference: 'TRX-000130',
      notes: null,
      createdAt: new Date().toISOString(),
    },
  ];

  obligations[0].outstandingBalance = 0;
  obligations[0].status = 'PENDIENTE';
  obligations[1].outstandingBalance = 0;
  obligations[1].status = 'PENDIENTE';
  obligations[4].outstandingBalance = 0;
  obligations[4].status = 'PENDIENTE';
  return { obligations: obligations.filter((item) => item.outstandingBalance > 0), payments, idempotency: {} };
}

function readDemoStore(): DemoStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const initial = initialDemoStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: unknown = JSON.parse(stored);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('obligations' in parsed) ||
      !('payments' in parsed) ||
      !Array.isArray(parsed.obligations) ||
      !Array.isArray(parsed.payments)
    ) {
      throw new Error('El almacenamiento local de pagos tiene un formato inválido.');
    }
    return { ...(parsed as Omit<DemoStore, 'idempotency'>), idempotency: 'idempotency' in parsed && typeof parsed.idempotency === 'object' && parsed.idempotency !== null ? parsed.idempotency as Record<string, string> : {} };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('No se pudieron leer los datos de demostración guardados. Limpia el almacenamiento local para continuar.');
    }
    throw error;
  }
}

function writeDemoStore(store: DemoStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (error) {
    throw new Error(`No se pudieron guardar los datos de demostración: ${error instanceof Error ? error.message : 'error de almacenamiento'}`);
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (error) {
    throw new Error(`No se pudo conectar con la API de Finanzas (${apiBaseUrl}): ${error instanceof Error ? error.message : 'error de red'}`);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : `La API respondió con estado ${response.status}.`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

function monthStart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function summarize(obligations: PaymentObligation[], payments: PaymentRecord[]): PaymentSummary {
  const today = localDate();
  const start = monthStart(new Date());
  return {
    pendingObligations: obligations.filter((item) => item.outstandingBalance > 0).length,
    paidThisMonth: payments
      .filter((item) => item.paymentDate >= start && item.paymentDate <= today)
      .reduce((total, item) => total + item.amount, 0),
    overdueObligations: obligations.filter((item) => item.outstandingBalance > 0 && item.dueDate < today).length,
  };
}

function stateForBalance(balance: number, originalAmount: number): ObligationStatus {
  return balance === originalAmount ? 'PENDIENTE' : 'PARCIAL';
}

export const paymentsService = {
  async listObligations(origin?: PaymentOrigin): Promise<PaymentObligation[]> {
    if (paymentsMode === 'api') {
      const query = origin ? `?origin=${encodeURIComponent(origin)}` : '';
      return apiRequest(`/payments/obligations${query}`);
    }
    const obligations = readDemoStore().obligations;
    return origin ? obligations.filter((item) => item.origin === origin) : obligations;
  },

  async getSummary(): Promise<PaymentSummary> {
    if (paymentsMode === 'api') return apiRequest('/payments/summary');
    const store = readDemoStore();
    return summarize(store.obligations, store.payments);
  },

  async listPayments(): Promise<PaymentRecord[]> {
    if (paymentsMode === 'api') return apiRequest('/payments');
    return readDemoStore().payments;
  },

  async getPayment(id: string): Promise<PaymentDetails> {
    if (paymentsMode === 'api') return apiRequest(`/payments/${encodeURIComponent(id)}`);
    const payment = readDemoStore().payments.find((item) => item.id === id);
    if (!payment) throw new Error('No se encontró el pago solicitado.');
    return {
      ...payment,
      originalAmount: payment.originalAmount ?? payment.amount,
      balanceBeforePayment: payment.balanceBeforePayment ?? payment.amount,
      balanceAfterPayment: payment.balanceAfterPayment ?? 0,
    };
  },

  async createPayment(input: CreatePaymentInput, idempotencyKey: string): Promise<PaymentRecord> {
    if (paymentsMode === 'api') {
      return apiRequest('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(input),
      });
    }

    const store = readDemoStore();
    const existingId = store.idempotency[idempotencyKey];
    const existingPayment = store.payments.find((item) => item.id === existingId);
    if (existingPayment) return existingPayment;
    const obligation = store.obligations.find((item) => item.id === input.obligationId);
    if (!obligation) throw new Error('La obligación seleccionada ya no está disponible.');
    if (input.amount <= 0 || input.amount > obligation.outstandingBalance) {
      throw new Error('El monto debe ser mayor que cero y no superar el saldo pendiente.');
    }
    if (!Number.isFinite(input.amount) || !Number.isFinite(Number(input.amount.toFixed(2)))) {
      throw new Error('El monto ingresado no es válido.');
    }
    if (
      input.bankReference &&
      store.payments.some((item) => item.bankReference?.toLowerCase() === input.bankReference?.toLowerCase())
    ) {
      throw new Error('Ya existe un pago con esa referencia bancaria.');
    }

    const balanceBeforePayment = obligation.outstandingBalance;
    const payment: PaymentRecord = {
      id: `P-${1001 + store.payments.length}`,
      obligationId: obligation.id,
      obligationCode: obligation.code,
      origin: obligation.origin,
      beneficiary: obligation.beneficiary,
      amount: input.amount,
      paymentDate: input.paymentDate,
      method: input.method,
      bankReference: input.bankReference,
      notes: input.notes,
      createdAt: new Date().toISOString(),
      originalAmount: obligation.originalAmount,
      balanceBeforePayment,
      balanceAfterPayment: Math.round((balanceBeforePayment - input.amount) * 100) / 100,
    };
    obligation.outstandingBalance = Math.round((obligation.outstandingBalance - input.amount) * 100) / 100;
    obligation.status = stateForBalance(obligation.outstandingBalance, obligation.originalAmount);
    if (obligation.outstandingBalance === 0) {
      store.obligations = store.obligations.filter((item) => item.id !== obligation.id);
    }
    store.payments = [payment, ...store.payments];
    store.idempotency[idempotencyKey] = payment.id;
    writeDemoStore(store);
    return payment;
  },
};
