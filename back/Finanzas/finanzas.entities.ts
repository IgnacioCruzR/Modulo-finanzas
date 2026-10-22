import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export type EstadoFactura = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';

// Las tablas ya existen (las crea sql/01_schema_y_datos.sql), por eso synchronize está en false.
// El esquema (finanzas u otro) se define una sola vez en app.module.ts con la opción "schema".

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ length: 100 })
  nombre!: string;

  @Column({ length: 120, unique: true })
  email!: string;
}

@Entity('metodo_pago')
export class MetodoPago {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ length: 50, unique: true })
  nombre!: string;
}

@Entity('factura')
export class Factura {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ length: 20, unique: true })
  numero!: string;

  @Column({ name: 'cliente_id' })
  clienteId!: number;

  @ManyToOne(() => Cliente, { nullable: false })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente;

  @Column({ name: 'fecha_emision', type: 'date' })
  fechaEmision!: string;

  @Column({ name: 'fecha_vencimiento', type: 'date' })
  fechaVencimiento!: string;

  // NUMERIC llega como string desde PostgreSQL (evita errores de redondeo)
  @Column({ name: 'monto_total', type: 'numeric', precision: 12, scale: 2 })
  montoTotal!: string;

  @Column({ type: 'varchar', length: 10, default: 'PENDIENTE' })
  estado!: EstadoFactura;
}

@Entity('pago')
export class Pago {
  @PrimaryGeneratedColumn('identity')
  id!: number;

  @Column({ name: 'factura_id' })
  facturaId!: number;

  @ManyToOne(() => Factura, { nullable: false })
  @JoinColumn({ name: 'factura_id' })
  factura!: Factura;

  @Column({ name: 'metodo_pago_id' })
  metodoPagoId!: number;

  @ManyToOne(() => MetodoPago, { nullable: false })
  @JoinColumn({ name: 'metodo_pago_id' })
  metodoPago!: MetodoPago;

  @Column({ name: 'fecha_pago', type: 'date' })
  fechaPago!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  monto!: string;
}