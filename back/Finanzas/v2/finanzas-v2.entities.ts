import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// BIGINT y NUMERIC se conservan como string para evitar pérdida de precisión.
// Las relaciones y restricciones las administra el DDL, nunca synchronize.
abstract class CuentaBase {
  @Column('smallint', { default: 1 }) cantidad_cuotas!: number;
  @Column('numeric', { precision: 15, scale: 2 }) monto_total!: string;
  @Column('numeric', { precision: 15, scale: 2 }) saldo_pendiente!: string;
  @Column('date') fecha_emision!: string;
  @Column('date', { nullable: true }) fecha_vencimiento!: string | null;
  @Column('varchar', { length: 20 }) estado!: string;
}

@Entity({ schema: 'finanzas', name: 'cuenta_cobrar' })
export class CuentaCobrar extends CuentaBase {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_cxc!: string;
  @Column('bigint', { unique: true }) id_venta!: string;
  @Column('bigint') id_cliente!: string;
}

@Entity({ schema: 'finanzas', name: 'cuenta_pagar' })
export class CuentaPagar extends CuentaBase {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_cxp!: string;
  @Column('bigint', { unique: true }) id_oc!: string;
  @Column('bigint') id_proveedor!: string;
}

@Entity({ schema: 'finanzas', name: 'cuenta_financiera' })
export class CuentaFinanciera {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_cuenta!: string;
  @Column('varchar', { length: 100 }) nombre!: string;
  @Column('numeric', { precision: 15, scale: 2 }) saldo_inicial!: string;
  @Column('char', { length: 3 }) moneda!: string;
  @Column('boolean') activa!: boolean;
  @Column('timestamptz') fecha_apertura!: Date;
}

@Entity({ schema: 'finanzas', name: 'pago' })
export class PagoV2 {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_pago!: string;
  @Column('bigint', { nullable: true }) id_cxc!: string | null;
  @Column('bigint', { nullable: true }) id_cxp!: string | null;
  @Column('bigint', { nullable: true }) id_empleado!: string | null;
  @Column('bigint', { nullable: true }) id_nomina!: string | null;
  @Column('bigint', { nullable: true }) id_reembolso!: string | null;
  @Column('varchar', { length: 20 }) tipo_operacion!: string;
  @Column('numeric', { precision: 15, scale: 2 }) monto!: string;
  @Column('varchar', { length: 30 }) metodo_pago!: string;
  @Column('varchar', { length: 20 }) estado!: string;
  @Column('timestamptz') fecha_solicitud!: Date;
  @Column('timestamptz', { nullable: true }) fecha_pago!: Date | null;
  @Column('text', { nullable: true }) descripcion!: string | null;
}

@Entity({ schema: 'finanzas', name: 'autorizacion_pago' })
export class AutorizacionPago {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_autorizacion!: string;
  @Column('bigint', { unique: true }) id_pago!: string;
  @Column('bigint') id_autorizador!: string;
  @Column('varchar', { length: 20 }) decision!: string;
  @Column('text', { nullable: true }) observacion!: string | null;
  @Column('timestamptz') fecha_autorizacion!: Date;
}

@Entity({ schema: 'finanzas', name: 'movimiento_financiero' })
export class MovimientoFinanciero {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_mov_fin!: string;
  @Column('bigint', { unique: true }) id_pago!: string;
  @Column('bigint') id_cuenta!: string;
  @Column('varchar', { length: 10 }) tipo_flujo!: string;
  @Column('numeric', { precision: 15, scale: 2 }) monto!: string;
  @Column('timestamptz') fecha_movimiento!: Date;
  @Column('text', { nullable: true }) descripcion!: string | null;
}

@Entity({ schema: 'finanzas', name: 'cuota' })
export class Cuota {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_cuota!: string;
  @Column('bigint', { nullable: true }) id_cxc!: string | null;
  @Column('bigint', { nullable: true }) id_cxp!: string | null;
  @Column('smallint') numero!: number;
  @Column('numeric', { precision: 15, scale: 2 }) monto!: string;
}

@Entity({ schema: 'finanzas', name: 'aplicacion_pago_cuota' })
export class AplicacionPagoCuota {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_aplicacion!: string;
  @Column('bigint') id_pago!: string;
  @Column('bigint') id_cuota!: string;
  @Column('numeric', { precision: 15, scale: 2 }) monto_aplicado!: string;
}

export const ENTIDADES_V2 = [CuentaCobrar, CuentaPagar, CuentaFinanciera, PagoV2, AutorizacionPago, MovimientoFinanciero, Cuota, AplicacionPagoCuota];
