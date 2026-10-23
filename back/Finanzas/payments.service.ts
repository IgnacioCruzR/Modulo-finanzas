import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { CreateOutgoingPaymentDto } from './payments.dto';

type OutgoingOrigin = 'PROVEEDOR' | 'NOMINA';

interface PaymentRow {
  id: string | number;
  obligationId: string | number;
  obligationCode: string;
  origin: OutgoingOrigin;
  beneficiary: string;
  amount: string | number;
  paymentDate: string;
  method: string;
  bankReference: string | null;
  notes: string | null;
  createdAt: Date | string;
  originalAmount: string | number;
  balanceBeforePayment: string | number;
  balanceAfterPayment: string | number;
}

interface ObligationRow {
  id: string | number;
  code: string;
  origin: OutgoingOrigin;
  beneficiary: string;
  originalAmount: string | number;
  outstandingBalance: string | number;
  dueDate: string;
  status: 'PENDIENTE' | 'PARCIAL';
}

function mapPayment(row: PaymentRow) {
  return {
    id: String(row.id),
    obligationId: Number(row.obligationId),
    obligationCode: row.obligationCode,
    origin: row.origin,
    beneficiary: row.beneficiary,
    amount: Number(row.amount),
    paymentDate: row.paymentDate,
    method: row.method,
    bankReference: row.bankReference,
    notes: row.notes,
    createdAt: row.createdAt,
    originalAmount: Number(row.originalAmount),
    balanceBeforePayment: Number(row.balanceBeforePayment),
    balanceAfterPayment: Number(row.balanceAfterPayment),
  };
}

const PAYMENT_SELECT = `
  SELECT
    p.id AS id,
    o.id AS "obligationId",
    o.codigo AS "obligationCode",
    o.origen AS origin,
    o.beneficiario AS beneficiary,
    m.monto AS amount,
    m.fecha_pago AS "paymentDate",
    p.metodo AS method,
    p.referencia_bancaria AS "bankReference",
    p.observaciones AS notes,
    m.created_at AS "createdAt",
    o.monto_original AS "originalAmount",
    m.saldo_anterior AS "balanceBeforePayment",
    m.saldo_restante AS "balanceAfterPayment"
  FROM finanzas.pago_egreso p
  JOIN finanzas.movimiento_egreso m ON m.id = p.movimiento_id
  JOIN finanzas.obligacion_egreso o ON o.id = p.obligacion_id
`;

@Injectable()
export class OutgoingPaymentsService {
  constructor(private readonly dataSource: DataSource) {}

  async listObligations(origin?: string) {
    if (origin && origin !== 'PROVEEDOR' && origin !== 'NOMINA') {
      throw new BadRequestException('El tipo de obligación debe ser PROVEEDOR o NOMINA.');
    }
    const parameters: unknown[] = [];
    const originFilter = origin ? `AND origen = $${parameters.push(origin)}` : '';
    const rows: ObligationRow[] = await this.dataSource.query(
      `SELECT id, codigo AS code, origen AS origin, beneficiario AS beneficiary,
              monto_original AS "originalAmount", saldo_pendiente AS "outstandingBalance",
              fecha_vencimiento AS "dueDate", estado AS status
       FROM finanzas.obligacion_egreso
       WHERE saldo_pendiente > 0 ${originFilter}
       ORDER BY fecha_vencimiento ASC, id ASC`,
      parameters,
    );
    return rows.map((row) => ({
      ...row,
      id: Number(row.id),
      originalAmount: Number(row.originalAmount),
      outstandingBalance: Number(row.outstandingBalance),
    }));
  }

  async getSummary() {
    const [result] = await this.dataSource.query(`
      SELECT
        (SELECT COUNT(*)::integer
         FROM finanzas.obligacion_egreso
         WHERE saldo_pendiente > 0) AS "pendingObligations",
        (SELECT COALESCE(SUM(monto), 0)
         FROM finanzas.movimiento_egreso
         WHERE fecha_pago >= date_trunc('month', CURRENT_DATE)::date
           AND fecha_pago < (date_trunc('month', CURRENT_DATE) + interval '1 month')::date) AS "paidThisMonth",
        (SELECT COUNT(*)::integer
         FROM finanzas.obligacion_egreso
         WHERE saldo_pendiente > 0 AND fecha_vencimiento < CURRENT_DATE) AS "overdueObligations"
    `);
    return {
      pendingObligations: Number(result.pendingObligations),
      paidThisMonth: Number(result.paidThisMonth),
      overdueObligations: Number(result.overdueObligations),
    };
  }

  async listPayments() {
    const rows: PaymentRow[] = await this.dataSource.query(
      `${PAYMENT_SELECT} ORDER BY m.fecha_pago DESC, p.id DESC`,
    );
    return rows.map(mapPayment);
  }

  async getPayment(id: number) {
    const [row]: PaymentRow[] = await this.dataSource.query(
      `${PAYMENT_SELECT} WHERE p.id = $1`,
      [id],
    );
    if (!row) throw new NotFoundException('No se encontró el pago solicitado.');
    return mapPayment(row);
  }

  async createPayment(dto: CreateOutgoingPaymentDto, idempotencyKey: string) {
    if (dto.method.toLocaleLowerCase('es-CL').includes('transferencia') && !dto.bankReference?.trim()) {
      throw new BadRequestException('La referencia bancaria es obligatoria para una transferencia.');
    }
    if (!Number.isFinite(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor que cero.');
    }

    const existing = await this.findByIdempotencyKey(idempotencyKey);
    if (existing) return mapPayment(existing);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const obligations: ObligationRow[] = await runner.query(
        `SELECT id, codigo AS code, origen AS origin, beneficiario AS beneficiary,
                monto_original AS "originalAmount", saldo_pendiente AS "outstandingBalance",
                fecha_vencimiento AS "dueDate", estado AS status
         FROM finanzas.obligacion_egreso
         WHERE id = $1
         FOR UPDATE`,
        [dto.obligationId],
      );
      const obligation = obligations[0];
      if (!obligation) throw new NotFoundException('La obligación seleccionada no existe.');

      const balanceBefore = Math.round(Number(obligation.outstandingBalance) * 100);
      const amountInCents = Math.round(dto.amount * 100);
      if (balanceBefore <= 0) throw new ConflictException('La obligación ya no tiene saldo pendiente.');
      if (amountInCents > balanceBefore) {
        throw new BadRequestException(
          `El monto supera el saldo pendiente de ${(balanceBefore / 100).toFixed(0)} CLP.`,
        );
      }

      const paymentDate = dto.paymentDate.slice(0, 10);
      const notes = dto.notes?.trim() || null;
      const reference = dto.bankReference?.trim() || null;
      const balanceAfter = balanceBefore - amountInCents;
      const movementRows = await runner.query(
        `INSERT INTO finanzas.movimiento_egreso
           (obligacion_id, monto, fecha_pago, idempotency_key, saldo_anterior, saldo_restante, descripcion)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          obligation.id,
          (amountInCents / 100).toFixed(2),
          paymentDate,
          idempotencyKey,
          (balanceBefore / 100).toFixed(2),
          (balanceAfter / 100).toFixed(2),
          notes,
        ],
      );
      const movementId = movementRows[0].id;
      const paymentRows = await runner.query(
        `INSERT INTO finanzas.pago_egreso
           (movimiento_id, obligacion_id, metodo, referencia_bancaria, observaciones)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [movementId, obligation.id, dto.method, reference, notes],
      );
      await runner.query(
        `UPDATE finanzas.obligacion_egreso
         SET saldo_pendiente = $2,
             estado = CASE WHEN $2 = 0 THEN 'PAGADA' ELSE 'PARCIAL' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [obligation.id, (balanceAfter / 100).toFixed(2)],
      );

      const [result]: PaymentRow[] = await runner.query(
        `${PAYMENT_SELECT} WHERE p.id = $1`,
        [paymentRows[0].id],
      );
      await runner.commitTransaction();
      return mapPayment(result);
    } catch (error) {
      await runner.rollbackTransaction();
      if (this.postgresCode(error) === '23505') {
        const duplicate = await this.findByIdempotencyKey(idempotencyKey);
        if (duplicate) return mapPayment(duplicate);
        throw new ConflictException('La referencia bancaria ya fue utilizada en otro pago.');
      }
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async findByIdempotencyKey(key: string) {
    const [row]: PaymentRow[] = await this.dataSource.query(
      `${PAYMENT_SELECT}
       WHERE m.idempotency_key = $1`,
      [key],
    );
    return row;
  }

  private postgresCode(error: unknown) {
    if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
    return String(error.code);
  }
}
