import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
// BIGINT y NUMERIC permanecen como string. Las restricciones las administra el DDL.
abstract class CuentaBase {
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
}
@Entity({ schema: 'finanzas', name: 'cuenta_pagar' })
export class CuentaPagar extends CuentaBase {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_cxp!: string;
  @Column('bigint', { unique: true }) id_oc!: string;
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
@Entity({ schema: 'finanzas', name: 'operacion_financiera' })
export class OperacionFinanciera {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_operacion!: string;
  @Column('bigint', { nullable: true }) id_cxc!: string | null;
  @Column('bigint', { nullable: true }) id_cxp!: string | null;
  @Column('bigint', { nullable: true }) id_reembolso!: string | null;
  @Column('numeric', { precision: 15, scale: 2 }) monto!: string;
  @Column('varchar', { length: 30, nullable: true }) metodo_pago!: string | null;
  @Column('varchar', { length: 20 }) estado!: string;
  @Column('timestamptz') fecha_solicitud!: Date;
  @Column('timestamptz', { nullable: true }) fecha_ejecucion!: Date | null;
  @Column('text', { nullable: true }) descripcion!: string | null;
}
@Entity({ schema: 'finanzas', name: 'autorizacion_financiera' })
export class AutorizacionFinanciera {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_autorizacion!: string;
  @Column('bigint', { unique: true }) id_operacion!: string;
  @Column('bigint') id_autorizador!: string;
  @Column('varchar', { length: 20 }) decision!: string;
  @Column('text', { nullable: true }) observacion!: string | null;
  @Column('timestamptz') fecha_autorizacion!: Date;
}
@Entity({ schema: 'finanzas', name: 'movimiento_financiero' })
export class MovimientoFinanciero {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) id_mov_fin!: string;
  @Column('bigint', { unique: true }) id_operacion!: string;
  @Column('bigint') id_cuenta!: string;
  @Column('varchar', { length: 10 }) tipo_flujo!: string;
  @Column('numeric', { precision: 15, scale: 2 }) monto!: string;
  @Column('timestamptz') fecha_movimiento!: Date;
  @Column('text', { nullable: true }) descripcion!: string | null;
}
export const ENTIDADES_V2 = [CuentaCobrar, CuentaPagar, CuentaFinanciera, OperacionFinanciera, AutorizacionFinanciera, MovimientoFinanciero];
