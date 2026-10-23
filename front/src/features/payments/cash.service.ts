import { cashMovementStorageKey, initialCashMovements } from './cash.mock';
import type {
  CashMovement,
  MovementDecision,
  MovementStatus,
  NewMovementRequest,
} from './cash.types';

function isCashMovement(value: unknown): value is CashMovement {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const decision = item.decision;
  const validDecision = decision === null || (
    typeof decision === 'object'
    && decision !== null
    && 'status' in decision
    && (decision.status === 'Autorizado' || decision.status === 'Rechazado')
    && 'decidedAt' in decision
    && typeof decision.decidedAt === 'string'
    && 'decidedBy' in decision
    && typeof decision.decidedBy === 'string'
    && 'reason' in decision
    && (decision.reason === null || typeof decision.reason === 'string')
    && 'simulated' in decision
    && decision.simulated === true
  );
  return typeof item.id === 'string'
    && ['Ventas', 'Compras', 'RR. HH.'].includes(String(item.origin))
    && ['Ingreso', 'Egreso'].includes(String(item.direction))
    && typeof item.reference === 'string'
    && typeof item.beneficiary === 'string'
    && typeof item.amount === 'number'
    && Number.isFinite(item.amount)
    && typeof item.requestDate === 'string'
    && typeof item.concept === 'string'
    && ['Pendiente', 'Autorizado', 'Rechazado'].includes(String(item.status))
    && (item.supportDescription === null || typeof item.supportDescription === 'string')
    && validDecision
    && item.simulated === true;
}

function persist(movements: CashMovement[]) {
  try {
    localStorage.setItem(cashMovementStorageKey, JSON.stringify(movements));
  } catch (error) {
    throw new Error(`No se pudieron guardar los movimientos de demostración: ${error instanceof Error ? error.message : 'error de almacenamiento'}`);
  }
}

export function listCashMovements(): CashMovement[] {
  let stored: string | null;
  try {
    stored = localStorage.getItem(cashMovementStorageKey);
  } catch (error) {
    throw new Error(`No se pudieron leer los movimientos de demostración: ${error instanceof Error ? error.message : 'error de almacenamiento'}`);
  }
  if (!stored) {
    const initial = initialCashMovements.map((item) => ({ ...item, decision: item.decision ? { ...item.decision } : null }));
    persist(initial);
    return initial;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    throw new Error('Los movimientos demostrativos guardados no tienen un formato válido.');
  }
  if (!Array.isArray(parsed) || !parsed.every(isCashMovement)) {
    throw new Error('Los movimientos demostrativos guardados no coinciden con el formato esperado.');
  }
  return parsed;
}

export function createCashMovement(input: NewMovementRequest, movements = listCashMovements()): CashMovement[] {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('El monto debe ser un número mayor que cero.');
  }
  if (!input.reference.trim() || !input.beneficiary.trim() || !input.concept.trim() || !input.requestDate) {
    throw new Error('Completa todos los campos obligatorios de la solicitud.');
  }
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const requestDate = /^\d{4}-\d{2}-\d{2}$/.test(input.requestDate)
    ? new Date(`${input.requestDate}T12:00:00`)
    : null;
  const normalizedRequestDate = requestDate
    ? `${requestDate.getFullYear()}-${String(requestDate.getMonth() + 1).padStart(2, '0')}-${String(requestDate.getDate()).padStart(2, '0')}`
    : '';
  const validDate = requestDate !== null
    && Number.isFinite(requestDate.getTime())
    && normalizedRequestDate === input.requestDate;
  if (!validDate || input.requestDate > today) {
    throw new Error('La fecha de solicitud debe ser válida y no puede estar en el futuro.');
  }
  const baseId = Date.now();
  let id = `MC-${baseId}`;
  let suffix = 1;
  while (movements.some((item) => item.id === id)) {
    id = `MC-${baseId}-${suffix}`;
    suffix += 1;
  }
  const next: CashMovement[] = [{
    id,
    ...input,
    reference: input.reference.trim(),
    beneficiary: input.beneficiary.trim(),
    concept: input.concept.trim(),
    status: 'Pendiente',
    supportDescription: null,
    decision: null,
    simulated: true,
  }, ...movements];
  persist(next);
  return next;
}

export function decideCashMovement(
  movementId: string,
  status: Exclude<MovementStatus, 'Pendiente'>,
  reason: string,
  movements = listCashMovements(),
): CashMovement[] {
  const current = movements.find((item) => item.id === movementId);
  if (!current) throw new Error('No se encontró la solicitud seleccionada.');
  if (current.status !== 'Pendiente') throw new Error('Esta solicitud ya tiene una decisión y no puede modificarse.');
  if (status === 'Rechazado' && !reason.trim()) throw new Error('Ingresa un motivo para rechazar la solicitud.');

  const decision: MovementDecision = {
    status,
    decidedAt: new Date().toISOString(),
    decidedBy: 'Administrador (demo)',
    reason: status === 'Rechazado' ? reason.trim() : null,
    simulated: true,
  };
  const next = movements.map((item): CashMovement => item.id === movementId
    ? { ...item, status, decision }
    : item);
  persist(next);
  return next;
}
