import type {
  AccountOption,
  CreatePaymentRequestPayload,
  OperationType,
  PaymentRequestErrors,
  PaymentRequestFormValues,
} from './paymentRequest.types';
import { operationTypes, paymentMethods } from './paymentRequest.types';

// Límites espejo de CrearOperacionDto.
export const MAX_AMOUNT = 9999999999999.99;
export const MAX_DESCRIPTION_LENGTH = 2000;

const thousandsFormat = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/;
const plainFormat = /^\d+([.,]\d{1,2})?$/;

/**
 * Convierte un monto escrito en formato chileno ("150.000", "1.250,50") o simple
 * ("150000", "99.5") a número. Devuelve null si el texto no es un monto válido.
 */
export function parseAmount(raw: string): number | null {
  const value = raw.trim().replace(/^\$\s*/, '');
  if (thousandsFormat.test(value)) return Number(value.replace(/\./g, '').replace(',', '.'));
  if (plainFormat.test(value)) return Number(value.replace(',', '.'));
  return null;
}

export function parseIdentifier(raw: string): number | null {
  const value = raw.trim();
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function accountsFor(operationType: PaymentRequestFormValues['operationType'], accounts: AccountOption[]) {
  if (operationType === 'cobro') return accounts.filter((item) => item.kind === 'cobrar');
  if (operationType === 'proveedor') return accounts.filter((item) => item.kind === 'pagar');
  return [];
}

export function isPayable(account: AccountOption) {
  return account.status !== 'pagada' && account.status !== 'anulada' && account.outstandingBalance > 0;
}

export function selectedAccount(values: PaymentRequestFormValues, accounts: AccountOption[]) {
  return accountsFor(values.operationType, accounts).find((item) => String(item.id) === values.accountId);
}

function validateIdentifier(raw: string, label: string) {
  if (!raw.trim()) return `Ingresa el ${label}.`;
  if (parseIdentifier(raw) === null) return `El ${label} debe ser un número entero positivo.`;
  return undefined;
}

export function validatePaymentRequest(values: PaymentRequestFormValues, accounts: AccountOption[]): PaymentRequestErrors {
  const errors: PaymentRequestErrors = {};
  const { operationType } = values;

  if (!operationType || !operationTypes.includes(operationType)) {
    errors.operationType = 'Selecciona el tipo de operación.';
  }

  const account = selectedAccount(values, accounts);
  if (operationType === 'cobro' || operationType === 'proveedor') {
    const label = operationType === 'cobro' ? 'cuenta por cobrar' : 'cuenta por pagar';
    if (!values.accountId) errors.accountId = `Selecciona la ${label} asociada.`;
    else if (!account) errors.accountId = `La ${label} seleccionada no existe.`;
    else if (!isPayable(account)) errors.accountId = `La ${label} está ${account.status} y no admite pagos.`;
  }
  if (operationType === 'nomina') errors.operationType = 'Los pagos de nómina no están disponibles en esta versión.';
  if (operationType === 'reembolso') {
    errors.refundId = validateIdentifier(values.refundId, 'ID de reembolso');
  }

  const amount = parseAmount(values.amount);
  if (!values.amount.trim()) errors.amount = 'Ingresa el monto del pago.';
  else if (amount === null) errors.amount = 'Usa solo números, con hasta dos decimales (ej.: 150.000 o 1250,50).';
  else if (amount <= 0) errors.amount = 'El monto debe ser mayor que cero.';
  else if (amount > MAX_AMOUNT) errors.amount = 'El monto supera el máximo permitido.';
  else if (account && isPayable(account) && amount > account.outstandingBalance) {
    errors.amount = 'El monto no puede superar el saldo pendiente de la cuenta.';
  }

  if (!values.method || !paymentMethods.includes(values.method)) {
    errors.method = 'Selecciona el método de pago.';
  }

  if (values.description.trim().length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `La descripción admite hasta ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  }

  if (!values.confirmed) {
    errors.confirmed = 'Confirma que revisaste los datos antes de registrar la solicitud.';
  }

  for (const key of Object.keys(errors) as (keyof PaymentRequestErrors)[]) {
    if (!errors[key]) delete errors[key];
  }
  return errors;
}

export function operationTypeFromPayload(payload: CreatePaymentRequestPayload): Exclude<OperationType, 'nomina'> {
  if (payload.id_cxc !== undefined) return 'cobro';
  if (payload.id_cxp !== undefined) return 'proveedor';
  return 'reembolso';
}

/** Arma el cuerpo de POST /operaciones; solo incluye campos de CrearOperacionDto. */
export function buildPaymentRequestPayload(values: PaymentRequestFormValues): CreatePaymentRequestPayload {
  if (!values.operationType || !values.method) throw new Error('El formulario no está completo.');
  if (values.operationType === 'nomina') throw new Error('Los pagos de nómina no están disponibles en esta versión.');
  const amount = parseAmount(values.amount);
  if (amount === null) throw new Error('El monto no es válido.');

  const payload: CreatePaymentRequestPayload = {
    monto: amount,
    metodo_pago: values.method,
  };
  if (values.operationType === 'cobro') payload.id_cxc = Number(values.accountId);
  if (values.operationType === 'proveedor') payload.id_cxp = Number(values.accountId);
  if (values.operationType === 'reembolso') payload.id_reembolso = parseIdentifier(values.refundId) ?? undefined;

  const description = values.description.trim();
  if (description) payload.descripcion = description;
  return payload;
}
