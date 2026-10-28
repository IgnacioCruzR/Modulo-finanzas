import { api, post } from '../../shared/services/api/client';
import type { CashMovement, MovementDecision, MovementStatus, NewMovementRequest } from './cash.types';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'simulado';
export interface OperacionApi {
  id_operacion: string; id_cxc: string | null; id_cxp: string | null; id_reembolso: string | null;
  monto: string; metodo_pago: MetodoPago | null; estado: 'pendiente' | 'rechazada' | 'ejecutada';
  fecha_solicitud: string; descripcion: string | null;
  autorizacion?: { id_autorizador: string; decision: 'aprobada' | 'rechazada'; observacion: string | null; fecha_autorizacion: string } | null;
}
function fechaLocal(iso: string): string {
  const fecha = new Date(iso);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}
export function toMovement(o: OperacionApi): CashMovement {
  const status: MovementStatus = o.estado === 'ejecutada' ? 'Autorizado' : o.estado === 'rechazada' ? 'Rechazado' : 'Pendiente';
  const decision: MovementDecision | null = o.autorizacion ? {
    status: status === 'Autorizado' ? 'Autorizado' : 'Rechazado',
    decidedAt: o.autorizacion.fecha_autorizacion,
    decidedBy: 'Administrador ' + o.autorizacion.id_autorizador,
    reason: o.autorizacion.observacion, simulated: false,
  } : null;
  const reference = o.id_cxc ? 'Cuenta por cobrar #' + o.id_cxc : o.id_cxp ? 'Cuenta por pagar #' + o.id_cxp : 'Reembolso #' + o.id_reembolso;
  return {
    id: o.id_operacion, origin: o.id_cxc ? 'Ventas' : o.id_cxp ? 'Compras' : 'Reembolsos',
    direction: o.id_cxc ? 'Ingreso' : 'Egreso', reference,
    beneficiary: o.metodo_pago ?? 'Método pendiente', amount: Number(o.monto),
    requestDate: fechaLocal(o.fecha_solicitud), concept: o.descripcion ?? 'Sin descripción',
    status, supportDescription: null, decision, simulated: false,
  };
}
const obtener = (id: string) => api<OperacionApi>('/operaciones/' + encodeURIComponent(id));
export async function listCashMovements(): Promise<CashMovement[]> {
  const operaciones = await api<OperacionApi[]>('/operaciones');
  return Promise.all(operaciones.map(async o => toMovement(o.estado === 'pendiente' ? o : await obtener(o.id_operacion))));
}
export async function createCashMovement(input: NewMovementRequest, metodoPago: MetodoPago = 'efectivo'): Promise<CashMovement> {
  const id = Number(input.reference.trim());
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('La referencia debe ser un identificador entero positivo.');
  const origen = input.origin === 'Ventas' && input.direction === 'Ingreso' ? { id_cxc: id }
    : input.origin === 'Compras' && input.direction === 'Egreso' ? { id_cxp: id }
    : input.origin === 'Reembolsos' && input.direction === 'Egreso' ? { id_reembolso: id } : null;
  if (!origen) throw new Error('Ventas admite ingresos; Compras y Reembolsos admiten egresos.');
  return toMovement(await post<OperacionApi>('/operaciones', {
    ...origen, monto: input.amount, metodo_pago: metodoPago, descripcion: input.concept.trim(),
  }));
}
export async function decideCashMovement(id: string, status: Exclude<MovementStatus, 'Pendiente'>, reason: string, metodoPago?: MetodoPago): Promise<CashMovement> {
  return toMovement(await post<OperacionApi>('/operaciones/' + encodeURIComponent(id) + '/decision',
    status === 'Rechazado' ? { decision: 'rechazada', observacion: reason.trim() } : { decision: 'aprobada', ...(metodoPago ? { metodo_pago: metodoPago } : {}) }));
}
