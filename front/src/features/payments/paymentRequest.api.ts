import { api } from '../../shared/services/api/client';
import type { CreatePaymentRequestPayload, PaymentMethod } from './paymentRequest.types';

/** El cuerpo ya es el contrato de la API, sin metadatos del formulario. */
export async function submitPaymentRequest(payload: CreatePaymentRequestPayload): Promise<CreatePaymentRequestPayload> {
  const response = await api<{ monto?: string | number; metodo_pago?: PaymentMethod | null }>(
    '/operaciones',
    { method: 'POST', body: JSON.stringify(payload) },
  );
  return {
    ...payload,
    monto: Number(response.monto ?? payload.monto),
    metodo_pago: response.metodo_pago ?? payload.metodo_pago,
  };
}
