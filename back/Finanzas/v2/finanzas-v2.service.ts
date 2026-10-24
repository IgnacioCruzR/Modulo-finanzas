import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CrearPagoDto, DecisionPagoDto, FiltrosCuentaDto, FiltrosPagoDto } from './finanzas-v2.dto';

type TipoCuenta = 'cobrar' | 'pagar';
const CUENTAS = {
  cobrar: { tabla: 'finanzas.cuenta_cobrar', pk: 'id_cxc', origen: 'id_venta', tercero: 'id_cliente' },
  pagar: { tabla: 'finanzas.cuenta_pagar', pk: 'id_cxp', origen: 'id_oc', tercero: 'id_proveedor' },
} as const;

interface PagoFila {
  id_pago: string;
  id_cxc: string | null;
  id_cxp: string | null;
  tipo_operacion: CrearPagoDto['tipo_operacion'];
  monto: string;
  estado: string;
}

@Injectable()
export class FinanzasV2Service {
  private readonly logger = new Logger(FinanzasV2Service.name);
  constructor(private readonly db: DataSource) {}

  private async operation<T>(action: () => Promise<T>): Promise<T> {
    try { return await action(); } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const pg = error as { code?: string; message?: string; driverError?: { code?: string; message?: string } };
      const code = pg.driverError?.code ?? pg.code;
      if (code === '23505') throw new ConflictException('Ya existe un registro con esa referencia.');
      if (code === '23503') throw new BadRequestException('La cuenta o el pago relacionado no existe.');
      if (['23514', '23502', '22003', '22007', '22008', '22P02'].includes(code ?? '')) {
        throw new BadRequestException('Los datos no cumplen las restricciones de la base.');
      }
      if (code === 'P0001') throw new ConflictException(pg.driverError?.message ?? pg.message ?? 'Operación no permitida.');
      this.logger.error(`Error de base de datos (${code ?? 'sin código'}).`);
      throw new InternalServerErrorException('No se pudo completar la operación.');
    }
  }

  health() {
    return this.operation(async () => {
      await this.db.query('SELECT 1');
      return { estado: 'ok', modelo: 'finanzas-v2', autenticacion: 'mock-local', modo: 'solo-consulta' };
    });
  }

  listarCuentas(tipo: TipoCuenta, filtros: FiltrosCuentaDto) {
    const c = CUENTAS[tipo];
    if ((tipo === 'cobrar' && filtros.orden_compra !== undefined) || (tipo === 'pagar' && filtros.venta !== undefined)) {
      throw new BadRequestException('El filtro no corresponde a este tipo de cuenta.');
    }
    return this.operation(() => this.db.query(
      `SELECT *,fecha_emision::text AS fecha_emision,fecha_vencimiento::text AS fecha_vencimiento FROM ${c.tabla} WHERE ($1::text IS NULL OR estado=$1)
       AND ($2::bigint IS NULL OR ${c.origen}=$2) ORDER BY ${c.pk} DESC`,
      [filtros.estado ?? null, (tipo === 'cobrar' ? filtros.venta : filtros.orden_compra) ?? null],
    ));
  }

  obtenerCuenta(tipo: TipoCuenta, id: string) {
    const c = CUENTAS[tipo];
    return this.operation(() => this.db.transaction('REPEATABLE READ', async (m) => {
      const [cuenta] = await m.query(`SELECT *,fecha_emision::text AS fecha_emision,fecha_vencimiento::text AS fecha_vencimiento FROM ${c.tabla} WHERE ${c.pk}=$1`, [id]);
      if (!cuenta) throw new NotFoundException('Cuenta no encontrada.');
      const cuotas = await m.query(`SELECT * FROM finanzas.v_cuotas WHERE ${c.pk}=$1 ORDER BY numero`, [id]);
      return { ...cuenta, cuotas };
    }));
  }

  listarPagos(f: FiltrosPagoDto) {
    return this.operation(() => this.db.query(
      `SELECT * FROM finanzas.pago WHERE ($1::text IS NULL OR estado=$1)
       AND ($2::text IS NULL OR tipo_operacion=$2) ORDER BY id_pago DESC`,
      [f.estado ?? null, f.tipo_operacion ?? null],
    ));
  }

  private async detallePago(m: EntityManager, id: string) {
    const [pago] = await m.query('SELECT * FROM finanzas.pago WHERE id_pago=$1', [id]);
    if (!pago) throw new NotFoundException('Pago no encontrado.');
    const [autorizacion] = await m.query('SELECT * FROM finanzas.autorizacion_pago WHERE id_pago=$1', [id]);
    const [movimiento] = await m.query('SELECT * FROM finanzas.movimiento_financiero WHERE id_pago=$1', [id]);
    const aplicaciones = await m.query(
      `SELECT a.id_aplicacion,a.id_cuota,c.numero,a.monto_aplicado
       FROM finanzas.aplicacion_pago_cuota a JOIN finanzas.cuota c ON c.id_cuota=a.id_cuota
       WHERE a.id_pago=$1 ORDER BY c.numero`, [id],
    );
    return { ...pago, autorizacion: autorizacion ?? null, movimiento: movimiento ?? null, aplicaciones };
  }

  obtenerPago(id: string) {
    return this.operation(() => this.db.transaction('REPEATABLE READ', (m) => this.detallePago(m, id)));
  }

  /** Validaciones */

  /** Cada tipo_operacion exige exactamente sus referencias de origen y rechaza las demás. */
  private validarOrigen(d: CrearPagoDto) {
    const requeridos: Record<CrearPagoDto['tipo_operacion'], (keyof CrearPagoDto)[]> = {
      cobro: ['id_cxc'],
      proveedor: ['id_cxp'],
      nomina: ['id_nomina', 'id_empleado'],
      reembolso: ['id_reembolso'],
    };
    const referencias = ['id_cxc', 'id_cxp', 'id_nomina', 'id_empleado', 'id_reembolso'] as const;
    const esperados = requeridos[d.tipo_operacion];
    const faltan = esperados.filter((c) => d[c] === undefined);
    if (faltan.length) {
      throw new BadRequestException(`Un pago de tipo "${d.tipo_operacion}" requiere: ${faltan.join(', ')}.`);
    }
    const sobran = referencias.filter((c) => d[c] !== undefined && !esperados.includes(c));
    if (sobran.length) {
      throw new BadRequestException(`Un pago de tipo "${d.tipo_operacion}" no admite: ${sobran.join(', ')}.`);
    }
  }

  /** La caja debe existir y estar activa para registrar, aprobar o ejecutar cualquier operación. */
  private async validarCajaActiva(m: EntityManager) {
    const [caja] = await m.query('SELECT activa FROM finanzas.cuenta_financiera WHERE id_cuenta=1');
    if (!caja) throw new NotFoundException('Caja no encontrada.');
    if (!caja.activa) throw new ConflictException('La caja está inactiva; no se pueden registrar operaciones.');
  }

  /** Bloquea la cuenta y valida: existe, no está anulada ni pagada y el monto no supera su saldo. */
  private async validarCuentaConSaldo(m: EntityManager, tipo: TipoCuenta, id: string | number, monto: string) {
    const c = CUENTAS[tipo];
    const etiqueta = tipo === 'cobrar' ? 'cuenta por cobrar' : 'cuenta por pagar';
    const [cuenta] = await m.query(
      `SELECT estado, saldo_pendiente::text AS saldo_pendiente, ($2::numeric > saldo_pendiente) AS excede
       FROM ${c.tabla} WHERE ${c.pk}=$1 FOR UPDATE`,
      [id, monto],
    );
    if (!cuenta) throw new NotFoundException(`La ${etiqueta} no existe.`);
    if (cuenta.estado === 'anulada') throw new ConflictException(`La ${etiqueta} está anulada.`);
    if (cuenta.estado === 'pagada') throw new ConflictException(`La ${etiqueta} ya está pagada; no tiene saldo pendiente.`);
    if (cuenta.excede) {
      throw new ConflictException(`El monto supera el saldo pendiente de la ${etiqueta} (saldo: ${cuenta.saldo_pendiente}).`);
    }
  }

  private async validarCuentaDelPago(m: EntityManager, pago: PagoFila) {
    if (pago.tipo_operacion === 'cobro') return this.validarCuentaConSaldo(m, 'cobrar', pago.id_cxc as string, pago.monto);
    if (pago.tipo_operacion === 'proveedor') return this.validarCuentaConSaldo(m, 'pagar', pago.id_cxp as string, pago.monto);
  }

  private async pagoBloqueado(m: EntityManager, id: string): Promise<PagoFila> {
    const [pago] = await m.query('SELECT * FROM finanzas.pago WHERE id_pago=$1 FOR UPDATE', [id]);
    if (!pago) throw new NotFoundException('Pago no encontrado.');
    return pago;
  }


  // Flujo: crearPago (pendiente) -> decidirPago (aprobado/rechazado) -> ejecutarPago (ejecutado).
  
  /** Crea una solicitud de pago en estado `pendiente`.*/
  crearPago(d: CrearPagoDto) {
    this.validarOrigen(d);
    const monto = d.monto.toFixed(2);
    return this.operation(() => this.db.transaction(async (m) => {
      if (d.tipo_operacion === 'cobro') await this.validarCuentaConSaldo(m, 'cobrar', d.id_cxc as number, monto);
      if (d.tipo_operacion === 'proveedor') await this.validarCuentaConSaldo(m, 'pagar', d.id_cxp as number, monto);
      await this.validarCajaActiva(m);
      const [{ id_pago }] = await m.query(
        `INSERT INTO finanzas.pago(id_cxc,id_cxp,id_empleado,id_nomina,id_reembolso,tipo_operacion,monto,metodo_pago,descripcion)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id_pago`,
        [d.id_cxc ?? null, d.id_cxp ?? null, d.id_empleado ?? null, d.id_nomina ?? null, d.id_reembolso ?? null,
          d.tipo_operacion, monto, d.metodo_pago, d.descripcion || null],
      );
      return this.detallePago(m, id_pago);
    }));
  }

  /** Aprueba o rechaza un pago pendiente. El autorizador viene de la sesión, nunca del cuerpo. */
  decidirPago(id: string, d: DecisionPagoDto, idAutorizador: number) {
    const aprobar = d.decision === 'aprobada';
    const observacion = d.observacion?.trim() || null;
    if (!aprobar && !observacion) throw new BadRequestException('Debes indicar el motivo del rechazo.');
    return this.operation(() => this.db.transaction(async (m) => {
      const pago = await this.pagoBloqueado(m, id);
      if (pago.estado !== 'pendiente') {
        throw new ConflictException(`Solo se puede decidir un pago pendiente; estado actual: ${pago.estado}.`);
      }
      if (aprobar) {
        await this.validarCuentaDelPago(m, pago);
        await this.validarCajaActiva(m);
      }
      await m.query('SELECT finanzas.decidir_pago($1,$2,$3,$4)', [id, idAutorizador, aprobar, observacion]);
      return this.detallePago(m, id);
    }));
  }

  /** Ejecuta un pago aprobado: movimiento de caja, saldo y estado de la cuenta, y aplicación a cuotas. */
  ejecutarPago(id: string) {
    return this.operation(() => this.db.transaction(async (m) => {
      await m.query('SELECT pg_advisory_xact_lock(71007, 1)'); // misma clave que usa ejecutar_pago
      const pago = await this.pagoBloqueado(m, id);
      if (pago.estado === 'ejecutado') throw new ConflictException('El pago ya fue ejecutado.');
      if (pago.estado !== 'aprobado') {
        throw new ConflictException(`El pago debe estar aprobado para ejecutarse; estado actual: ${pago.estado}.`);
      }
      await this.validarCuentaDelPago(m, pago);
      await this.validarCajaActiva(m);
      await m.query('SELECT finanzas.ejecutar_pago($1)', [id]);
      return this.detallePago(m, id);
    }));
  }

  saldo() {
    return this.operation(async () => {
      const [caja] = await this.db.query('SELECT * FROM finanzas.v_saldo_caja WHERE id_cuenta=1');
      if (!caja) throw new NotFoundException('Caja no encontrada.');
      return caja;
    });
  }

  movimientos() {
    return this.operation(() => this.db.query('SELECT * FROM finanzas.movimiento_financiero ORDER BY id_mov_fin DESC'));
  }
}
