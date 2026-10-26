import { api, post } from '../../shared/services/api/client';
import type { CashMovement, MovementDecision, MovementOrigin, MovementStatus, NewMovementRequest } from './cash.types';

// ---- Forma de las respuestas de la API (snake_case; BIGINT y NUMERIC llegan como string) ----
type TipoOperacion = 'cobro' | 'proveedor' | 'nomina' | 'reembolso';
type EstadoPago = 'pendiente' | 'aprobado' | 'rechazado' | 'ejecutado';
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'simulado';

interface PagoApi {
  id_pago: string;
  id_cxc: string | null;
  id_cxp: string | null;
  id_empleado: string | null;
  id_nomina: string | null;
  id_reembolso: string | null;
  tipo_operacion: TipoOperacion;
  monto: string;
  metodo_pago: MetodoPago;
  estado: EstadoPago;
  fecha_solicitud: string;
  descripcion: string | null;
}
interface PagoDetalleApi extends PagoApi {
  autorizacion: { id_autorizador: string; decision: 'aprobada' | 'rechazada'; observacion: string | null; fecha_autorizacion: string } | null;
}

// ---- Traducción API -> modelo que ya usa CashManagementPage ----
const ORIGEN: Record<TipoOperacion, MovementOrigin> = {
  cobro: 'Ventas', proveedor: 'Compras', nomina: 'RR. HH.', reembolso: 'Ventas',
};

function fechaLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function referencia(p: PagoApi): string {
  if (p.tipo_operacion === 'cobro') return `Cuenta por cobrar #${p.id_cxc}`;
  if (p.tipo_operacion === 'proveedor') return `Cuenta por pagar #${p.id_cxp}`;
  if (p.tipo_operacion === 'nomina') return `Nómina #${p.id_nomina}`;
  return `Reembolso #${p.id_reembolso}`;
}

function beneficiario(p: PagoApi): string {
  const tercero = p.tipo_operacion === 'cobro' ? 'Cliente'
    : p.tipo_operacion === 'proveedor' ? 'Proveedor'
      : p.tipo_operacion === 'nomina' ? `Empleado #${p.id_empleado}` : 'Cliente (reembolso)';
  return `${tercero} · ${p.metodo_pago}`;
}

// `aprobado` aún no mueve la caja: se muestra Pendiente para poder reintentar la ejecución.
function estado(e: EstadoPago): MovementStatus {
  return e === 'ejecutado' ? 'Autorizado' : e === 'rechazado' ? 'Rechazado' : 'Pendiente';
}

function decision(p: PagoDetalleApi): MovementDecision | null {
  if (!p.autorizacion || (p.estado !== 'ejecutado' && p.estado !== 'rechazado')) return null;
  return {
    status: p.estado === 'ejecutado' ? 'Autorizado' : 'Rechazado',
    decidedAt: p.autorizacion.fecha_autorizacion,
    decidedBy: `Administrador ${p.autorizacion.id_autorizador}`,
    reason: p.autorizacion.observacion,
    simulated: true, // el tipo actual lo exige; relajarlo en cash.types.ts cuando se retire la demo
  };
}

function toMovement(p: PagoDetalleApi): CashMovement {
  return {
    id: p.id_pago,
    origin: ORIGEN[p.tipo_operacion],
    direction: p.tipo_operacion === 'cobro' ? 'Ingreso' : 'Egreso',
    reference: referencia(p),
    beneficiary: beneficiario(p),
    amount: Number(p.monto),
    requestDate: fechaLocal(p.fecha_solicitud),
    concept: p.descripcion ?? 'Sin descripción',
    status: estado(p.estado),
    supportDescription: null,
    decision: decision(p),
    simulated: true,
  };
}

const obtenerPago = (id: string) => api<PagoDetalleApi>(`/pagos/${id}`);

// ---- Operaciones (mismos nombres que cash.service.ts, pero asíncronas) ----

/** GET /pagos. El detalle (con la autorización) solo se pide para pagos ya decididos. */
export async function listCashMovements(): Promise<CashMovement[]> {
  const pagos = await api<PagoApi[]>('/pagos');
  const detalles = await Promise.all(pagos.map((p) =>
    p.estado === 'ejecutado' || p.estado === 'rechazado' ? obtenerPago(p.id_pago) : { ...p, autorizacion: null }));
  return detalles.map(toMovement);
}

/** POST /pagos. `reference` debe ser el id numérico de la cuenta (por cobrar o por pagar). */
export async function createCashMovement(input: NewMovementRequest, metodoPago: MetodoPago = 'efectivo'): Promise<CashMovement> {
  const id = Number(input.reference.trim());
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('La referencia debe ser el número de la cuenta (por ejemplo 1).');
  }
  const origen =
    input.origin === 'Ventas' && input.direction === 'Ingreso' ? { tipo_operacion: 'cobro', id_cxc: id }
      : input.origin === 'Compras' && input.direction === 'Egreso' ? { tipo_operacion: 'proveedor', id_cxp: id }
        : null;
  if (!origen) throw new Error('Por ahora solo se pueden registrar cobros (Ventas · Ingreso) y pagos a proveedores (Compras · Egreso).');
  const pago = await post<PagoDetalleApi>('/pagos', {
    ...origen, monto: input.amount, metodo_pago: metodoPago, descripcion: input.concept.trim(),
  });
  return toMovement(pago);
}

/**
 * Autorizar = decisión "aprobada" + ejecución (aquí se mueve la caja).
 * Es reanudable: si una llamada anterior dejó el pago `aprobado`, solo se ejecuta.
 */
export async function decideCashMovement(id: string, status: Exclude<MovementStatus, 'Pendiente'>, reason: string): Promise<CashMovement> {
  if (status === 'Rechazado') {
    await post(`/pagos/${id}/decision`, { decision: 'rechazada', observacion: reason.trim() });
  } else {
    const actual = await obtenerPago(id);
    if (actual.estado === 'pendiente') await post(`/pagos/${id}/decision`, { decision: 'aprobada' });
    await post(`/pagos/${id}/ejecutar`, {});
  }
  return toMovement(await obtenerPago(id));
}

