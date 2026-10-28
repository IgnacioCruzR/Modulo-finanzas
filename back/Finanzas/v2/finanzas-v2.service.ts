import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CrearCuentaCobrarDto, CrearCuentaPagarDto, CrearOperacionDto, DecisionOperacionDto, FiltrosCuentaDto, FiltrosOperacionDto } from './finanzas-v2.dto';
import { IntegracionExternaService } from './integracion-externa.service';
type TipoCuenta = 'cobrar' | 'pagar';
const CUENTAS = {
  cobrar: { tabla: 'finanzas.cuenta_cobrar', pk: 'id_cxc', origen: 'id_venta' },
  pagar: { tabla: 'finanzas.cuenta_pagar', pk: 'id_cxp', origen: 'id_oc' },
} as const;
interface OperacionFila {
  id_operacion: string; id_cxc: string | null; id_cxp: string | null; id_reembolso: string | null;
  monto: string; metodo_pago: string | null; estado: string;
}
@Injectable()
export class FinanzasV2Service {
  private readonly logger = new Logger(FinanzasV2Service.name);
  constructor(private readonly db: DataSource, private readonly externos: IntegracionExternaService) {}
  private async operation<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const pg = error as { code?: string; message?: string; driverError?: { code?: string; message?: string } };
      const code = pg.driverError?.code ?? pg.code;
      if (code === '23505') throw new ConflictException('Ya existe un registro con esa referencia.');
      if (code === '23503') throw new BadRequestException('La referencia interna no existe.');
      if (['23514', '23502', '22003', '22007', '22008', '22P02'].includes(code ?? '')) throw new BadRequestException('Los datos no cumplen las restricciones de la base.');
      if (code === 'P0001') throw new ConflictException(pg.driverError?.message ?? pg.message ?? 'Operación no permitida.');
      this.logger.error('Error de base de datos (' + (code ?? 'sin código') + ').');
      throw new InternalServerErrorException('No se pudo completar la operación.');
    }
  }
  health() {
    return this.operation(async () => {
      // Falla también si solo se aplicó el esquema anterior.
      await this.db.query('SELECT id_operacion FROM finanzas.operacion_financiera LIMIT 0');
      return { estado: 'ok', modelo: 'finanzas-central', autenticacion: 'mock-local', integracion: this.externos.modo, modo: 'transaccional' };
    });
  }
  listarCuentas(tipo: TipoCuenta, filtros: FiltrosCuentaDto) {
    const c = CUENTAS[tipo];
    if ((tipo === 'cobrar' && filtros.orden_compra !== undefined) || (tipo === 'pagar' && filtros.venta !== undefined)) throw new BadRequestException('El filtro no corresponde a este tipo de cuenta.');
    return this.operation(() => this.db.query(
      `SELECT *,fecha_emision::text AS fecha_emision,fecha_vencimiento::text AS fecha_vencimiento FROM ${c.tabla}
       WHERE ($1::text IS NULL OR estado=$1) AND ($2::bigint IS NULL OR ${c.origen}=$2) ORDER BY ${c.pk} DESC`,
      [filtros.estado ?? null, (tipo === 'cobrar' ? filtros.venta : filtros.orden_compra) ?? null]));
  }
  obtenerCuenta(tipo: TipoCuenta, id: string) {
    return this.operation(async () => {
      const c = CUENTAS[tipo];
      const [cuenta] = await this.db.query(`SELECT *,fecha_emision::text AS fecha_emision,fecha_vencimiento::text AS fecha_vencimiento FROM ${c.tabla} WHERE ${c.pk}=$1`, [id]);
      if (!cuenta) throw new NotFoundException('Cuenta no encontrada.');
      return cuenta;
    });
  }
  crearCuenta(tipo: TipoCuenta, d: CrearCuentaCobrarDto | CrearCuentaPagarDto) {
    return this.operation(async () => {
      const c = CUENTAS[tipo];
      const id = tipo === 'cobrar' ? (d as CrearCuentaCobrarDto).id_venta : (d as CrearCuentaPagarDto).id_oc;
      await this.externos.validar(tipo === 'cobrar' ? 'venta' : 'orden_compra', id);
      const [{ valido }] = await this.db.query('SELECT $2::date IS NULL OR $2::date>=COALESCE($1::date,CURRENT_DATE) AS valido', [d.fecha_emision ?? null, d.fecha_vencimiento ?? null]);
      if (!valido) throw new BadRequestException('El vencimiento no puede ser anterior a la emisión.');
      const [cuenta] = await this.db.query(
        `INSERT INTO ${c.tabla}(${c.origen},monto_total,saldo_pendiente,fecha_emision,fecha_vencimiento)
         VALUES($1,$2,$2,COALESCE($3::date,CURRENT_DATE),$4::date) RETURNING *`,
        [id, d.monto_total.toFixed(2), d.fecha_emision ?? null, d.fecha_vencimiento ?? null]);
      return cuenta;
    });
  }
  listarOperaciones(f: FiltrosOperacionDto) {
    return this.operation(() => this.db.query(
      `SELECT * FROM finanzas.operacion_financiera WHERE ($1::text IS NULL OR estado=$1)
       AND ($2::text IS NULL OR CASE WHEN id_cxc IS NOT NULL THEN 'cobro' WHEN id_cxp IS NOT NULL THEN 'proveedor' ELSE 'reembolso' END=$2)
       ORDER BY id_operacion DESC`, [f.estado ?? null, f.origen ?? null]));
  }
  private async detalle(m: EntityManager, id: string) {
    const [o] = await m.query('SELECT * FROM finanzas.operacion_financiera WHERE id_operacion=$1', [id]);
    if (!o) throw new NotFoundException('Operación no encontrada.');
    const [autorizacion] = await m.query('SELECT * FROM finanzas.autorizacion_financiera WHERE id_operacion=$1', [id]);
    const [movimiento] = await m.query('SELECT * FROM finanzas.movimiento_financiero WHERE id_operacion=$1', [id]);
    return { ...o, autorizacion: autorizacion ?? null, movimiento: movimiento ?? null };
  }
  obtenerOperacion(id: string) {
    return this.operation(() => this.db.transaction('REPEATABLE READ', m => this.detalle(m, id)));
  }
  private async validarOrigenExterno(o: Pick<OperacionFila, 'id_cxc' | 'id_cxp' | 'id_reembolso'>) {
    if (o.id_reembolso != null) return this.externos.validar('reembolso', o.id_reembolso);
    const tipo: TipoCuenta = o.id_cxc != null ? 'cobrar' : 'pagar';
    const c = CUENTAS[tipo];
    const [cuenta] = await this.db.query(`SELECT ${c.origen} AS origen FROM ${c.tabla} WHERE ${c.pk}=$1`, [o.id_cxc ?? o.id_cxp]);
    if (!cuenta) throw new NotFoundException('Obligación no encontrada.');
    await this.externos.validar(tipo === 'cobrar' ? 'venta' : 'orden_compra', cuenta.origen);
  }
  private async validarObligacion(m: EntityManager, o: Pick<OperacionFila, 'id_cxc' | 'id_cxp' | 'monto'>) {
    if (o.id_cxc == null && o.id_cxp == null) return;
    const c = CUENTAS[o.id_cxc != null ? 'cobrar' : 'pagar'];
    const [cuenta] = await m.query(`SELECT estado,($2::numeric>saldo_pendiente) AS excede FROM ${c.tabla} WHERE ${c.pk}=$1 FOR UPDATE`, [o.id_cxc ?? o.id_cxp, o.monto]);
    if (!cuenta) throw new NotFoundException('Obligación no encontrada.');
    if (cuenta.estado === 'anulada' || cuenta.estado === 'pagada' || cuenta.excede) throw new ConflictException('La obligación no admite este importe o no tiene saldo pendiente.');
  }
  crearOperacion(d: CrearOperacionDto) {
    if ([d.id_cxc, d.id_cxp, d.id_reembolso].filter(v => v != null).length !== 1) throw new BadRequestException('Indica exactamente un origen: id_cxc, id_cxp o id_reembolso.');
    const o = { id_cxc: d.id_cxc == null ? null : String(d.id_cxc), id_cxp: d.id_cxp == null ? null : String(d.id_cxp), id_reembolso: d.id_reembolso == null ? null : String(d.id_reembolso), monto: d.monto.toFixed(2) };
    return this.operation(async () => {
      await this.validarOrigenExterno(o);
      return this.db.transaction(async m => {
        await this.validarObligacion(m, o);
        const [caja] = await m.query('SELECT activa FROM finanzas.cuenta_financiera WHERE id_cuenta=1');
        if (!caja?.activa) throw new ConflictException('Caja inexistente o inactiva.');
        const [{ id_operacion }] = await m.query(
          'INSERT INTO finanzas.operacion_financiera(id_cxc,id_cxp,id_reembolso,monto,metodo_pago,descripcion) VALUES($1,$2,$3,$4,$5,$6) RETURNING id_operacion',
          [o.id_cxc, o.id_cxp, o.id_reembolso, o.monto, d.metodo_pago ?? null, d.descripcion || null]);
        return this.detalle(m, id_operacion);
      });
    });
  }
  decidirOperacion(id: string, d: DecisionOperacionDto, autorizador: number) {
    if (d.decision === 'rechazada' && !d.observacion?.trim()) throw new BadRequestException('Debes indicar el motivo del rechazo.');
    if (d.decision === 'rechazada' && d.metodo_pago !== undefined) throw new BadRequestException('El rechazo no recibe método de pago.');
    return this.operation(async () => {
      await this.externos.validar('usuario', autorizador);
      const [o] = await this.db.query('SELECT * FROM finanzas.operacion_financiera WHERE id_operacion=$1', [id]);
      if (!o) throw new NotFoundException('Operación no encontrada.');
      if (o.estado !== 'pendiente') throw new ConflictException('La operación ya tiene una decisión.');
      if (d.decision === 'aprobada') {
        if (!(d.metodo_pago ?? o.metodo_pago)) throw new BadRequestException('La ejecución requiere método de pago.');
        await this.validarOrigenExterno(o);
      }
      return this.db.transaction(async m => {
        // La función SQL adquiere siempre primero el candado de caja y revalida las filas.
        await m.query('SELECT finanzas.decidir_operacion($1,$2,$3,$4,$5)',
          [id, autorizador, d.decision === 'aprobada', d.observacion?.trim() || null, d.metodo_pago ?? null]);
        return this.detalle(m, id);
      });
    });
  }
  saldo() {
    return this.operation(async () => {
      const [caja] = await this.db.query('SELECT * FROM finanzas.v_saldo_caja WHERE id_cuenta=1');
      if (!caja) throw new NotFoundException('Caja no encontrada.');
      return caja;
    });
  }
  movimientos() { return this.operation(() => this.db.query('SELECT * FROM finanzas.movimiento_financiero ORDER BY id_mov_fin DESC')); }
}
