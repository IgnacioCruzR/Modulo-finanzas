import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from './../db/db.module';
import { CreateFacturaDto, CreatePagoDto } from './dto/finanzas.dto';

const ESTADOS = ['PENDIENTE', 'PARCIAL', 'PAGADA'];
const cents = (n: number | string) => Math.round(Number(n) * 100);

@Injectable()
export class FinanzasService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // ---------- Catálogos para los desplegables del formulario ----------
  async clientes() {
    return (await this.pool.query('SELECT id, nombre, email FROM cliente ORDER BY nombre')).rows;
  }

  async metodosPago() {
    return (await this.pool.query('SELECT id, nombre FROM metodo_pago ORDER BY id')).rows;
  }

  // ---------- Formulario de ingreso: factura ----------
  async crearFactura(d: CreateFacturaDto) {
    if (d.fechaVencimiento < d.fechaEmision) {
      throw new BadRequestException('La fecha de vencimiento no puede ser anterior a la de emisión');
    }
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO factura (numero, cliente_id, fecha_emision, fecha_vencimiento, monto_total)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [d.numero, d.clienteId, d.fechaEmision, d.fechaVencimiento, d.montoTotal],
      );
      return rows[0];
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Ya existe una factura con ese número');
      if (e.code === '23503') throw new BadRequestException('El cliente indicado no existe');
      throw e;
    }
  }

  // ---------- Formulario de ingreso: pago (validación de saldo) ----------
  async registrarPago(facturaId: number, d: CreatePagoDto) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // FOR UPDATE evita que dos pagos simultáneos superen el saldo
      const f = await client.query('SELECT monto_total FROM factura WHERE id = $1 FOR UPDATE', [facturaId]);
      if (!f.rowCount) throw new NotFoundException('Factura no encontrada');

      const pagado = await client.query(
        'SELECT COALESCE(SUM(monto), 0) AS total FROM pago WHERE factura_id = $1',
        [facturaId],
      );
      const saldo = cents(f.rows[0].monto_total) - cents(pagado.rows[0].total);
      const monto = cents(d.monto);

      if (monto > saldo) {
        throw new BadRequestException(
          `El pago supera el saldo pendiente de la factura (saldo: ${(saldo / 100).toFixed(2)})`,
        );
      }

      const ins = await client.query(
        `INSERT INTO pago (factura_id, metodo_pago_id, fecha_pago, monto)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [facturaId, d.metodoPagoId, d.fechaPago, d.monto],
      );
      const estado = monto === saldo ? 'PAGADA' : 'PARCIAL';
      await client.query('UPDATE factura SET estado = $1 WHERE id = $2', [estado, facturaId]);

      await client.query('COMMIT');
      return { pago: ins.rows[0], estadoFactura: estado, saldoRestante: (saldo - monto) / 100 };
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (e.code === '23503') throw new BadRequestException('El método de pago indicado no existe');
      throw e;
    } finally {
      client.release();
    }
  }

  // ---------- Formulario de consulta ----------
  async listarFacturas(estado?: string, desde?: string, hasta?: string) {
    if (estado && !ESTADOS.includes(estado)) {
      throw new BadRequestException(`Estado inválido. Usa: ${ESTADOS.join(', ')}`);
    }
    const { rows } = await this.pool.query(
      `SELECT f.id, f.numero, c.nombre AS cliente, f.fecha_emision, f.fecha_vencimiento,
              f.monto_total, f.estado, f.monto_total - COALESCE(SUM(p.monto), 0) AS saldo
       FROM factura f
       JOIN cliente c ON c.id = f.cliente_id
       LEFT JOIN pago p ON p.factura_id = f.id
       WHERE ($1::text IS NULL OR f.estado = $1)
         AND ($2::date IS NULL OR f.fecha_emision >= $2)
         AND ($3::date IS NULL OR f.fecha_emision <= $3)
       GROUP BY f.id, c.nombre
       ORDER BY f.fecha_emision DESC, f.id DESC`,
      [estado ?? null, desde ?? null, hasta ?? null],
    );
    return rows;
  }

  async obtenerFactura(id: number) {
    const f = await this.pool.query(
      `SELECT f.*, c.nombre AS cliente FROM factura f JOIN cliente c ON c.id = f.cliente_id WHERE f.id = $1`,
      [id],
    );
    if (!f.rowCount) throw new NotFoundException('Factura no encontrada');
    const pagos = await this.pool.query(
      `SELECT p.id, p.fecha_pago, p.monto, m.nombre AS metodo
       FROM pago p JOIN metodo_pago m ON m.id = p.metodo_pago_id
       WHERE p.factura_id = $1 ORDER BY p.fecha_pago, p.id`,
      [id],
    );
    const pagado = pagos.rows.reduce((acc, p) => acc + cents(p.monto), 0);
    return { ...f.rows[0], pagos: pagos.rows, saldo: (cents(f.rows[0].monto_total) - pagado) / 100 };
  }
}