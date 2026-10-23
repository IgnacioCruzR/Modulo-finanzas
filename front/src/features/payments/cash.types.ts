export type MovementOrigin = 'Ventas' | 'Compras' | 'RR. HH.';
export type MovementDirection = 'Ingreso' | 'Egreso';
export type MovementStatus = 'Pendiente' | 'Autorizado' | 'Rechazado';

export interface MovementDecision {
  status: Exclude<MovementStatus, 'Pendiente'>;
  decidedAt: string;
  decidedBy: string;
  reason: string | null;
  simulated: true;
}

export interface CashMovement {
  id: string;
  origin: MovementOrigin;
  direction: MovementDirection;
  reference: string;
  beneficiary: string;
  amount: number;
  requestDate: string;
  concept: string;
  status: MovementStatus;
  supportDescription: string | null;
  decision: MovementDecision | null;
  simulated: true;
}

export interface NewMovementRequest {
  origin: MovementOrigin;
  direction: MovementDirection;
  reference: string;
  beneficiary: string;
  amount: number;
  requestDate: string;
  concept: string;
}
