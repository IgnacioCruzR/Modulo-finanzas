import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateFacturaDto, CreatePagoDto } from './dto/finanzas.dto';
import { Cliente, EstadoFactura, Factura, MetodoPago, Pago } from './finanzas.entities';

const ESTADOS: EstadoFactura[] = ['PENDIENTE', 'PARCIAL', 'PAGADA'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const cents = (n: number | string) => Math.round(Number(n) * 100);
const pgCode = (e: any) => e?.code ?? e?.driverError?.code;

@Injectable()
export class FinanzasService {
  constructor(
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(MetodoPago) private readonly metodos: Repository<MetodoPago>,
    @InjectRepository(Factura) private readonly facturas: Repository<Factura>,
    @InjectRepository(Pago) private readonly pagos: Repository<Pago>,
    private readonly dataSource: DataSource,
  ) {}

  // ---------- Catálogos para los desplegables ----------
  listarClientes() {
    return this.clientes.find({ order: { nombre: 'ASC' } });
  }

  listarMetodosPago() {
    return this.metodos.find({ order: { id: 'ASC' } });
  }

  // ---------- Ingreso: factura ----------
  async crearFactura(d: CreateFacturaDto) {
    if (d.fechaVencimiento < d.fechaEmision) {
      throw new BadRequestException('La fecha de vencimiento no puede ser anterior a la de emisión');
    }
    try {
      const factura = this.facturas.create({
        numero: d.numero,
        clienteId: d.clienteId,
        fechaEmision: d.fechaEmision,
        fechaVencimiento: d.fechaVencimiento,
        montoTotal: d.montoTotal.toFixed(2),
      });
      return await this.facturas.save(factura);
    } catch (e) {
      if (pgCode(e) === '23505') throw new ConflictException('Ya existe una factura con ese número');
      if (pgCode(e) === '23503') throw new BadRequestException('El cliente indicado no existe');
      throw e;
    }
  }

  // ---------- Ingreso: pago (transacción + validación de saldo) ----------
  async registrarPago(facturaId: number, d: CreatePagoDto) {
    try {
      return await this.dataSource.transaction(async (m) => {
        // Bloqueo de fila: evita que dos pagos simultáneos superen el saldo
        const factura = await m
          .getRepository(Factura)
          .createQueryBuilder('f')
          .setLock('pessimistic_write')
          .where('f.id = :id', { id: facturaId })
          .getOne();
        if (!factura) throw new NotFoundException('Factura no encontrada');

        const { total } = await m
          .getRepository(Pago)
          .createQueryBuilder('p')
          .select('COALESCE(SUM(p.monto), 0)', 'total')
          .where('p.facturaId = :id', { id: facturaId })
          .getRawOne();

        const saldo = cents(factura.montoTotal) - cents(total);
        const monto = cents(d.monto);
        if (monto > saldo) {
          throw new BadRequestException(
            `El pago supera el saldo pendiente de la factura (saldo: ${(saldo / 100).toFixed(2)})`,
          );
        }

        const pago = await m.save(
          m.create(Pago, {
            facturaId,
            metodoPagoId: d.metodoPagoId,
            fechaPago: d.fechaPago,
            monto: d.monto.toFixed(2),
          }),
        );
        const estado: EstadoFactura = monto === saldo ? 'PAGADA' : 'PARCIAL';
        await m.update(Factura, { id: facturaId }, { estado });

        return { pago, estadoFactura: estado, saldoRestante: (saldo - monto) / 100 };
      });
    } catch (e) {
      if (pgCode(e) === '23503') throw new BadRequestException('El método de pago indicado no existe');
      throw e;
    }
  }

  // ---------- Consulta ----------
  async listarFacturas(estado?: string, desde?: string, hasta?: string) {
    if (estado && !ESTADOS.includes(estado as EstadoFactura)) {
      throw new BadRequestException(`Estado inválido. Usa: ${ESTADOS.join(', ')}`);
    }
    if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) {
      throw new BadRequestException('Las fechas deben tener formato AAAA-MM-DD');
    }

    const qb = this.facturas.createQueryBuilder('f').leftJoinAndSelect('f.cliente', 'c');
    if (estado) qb.andWhere('f.estado = :estado', { estado });
    if (desde) qb.andWhere('f.fechaEmision >= :desde', { desde });
    if (hasta) qb.andWhere('f.fechaEmision <= :hasta', { hasta });
    const lista = await qb.orderBy('f.fechaEmision', 'DESC').addOrderBy('f.id', 'DESC').getMany();
    if (!lista.length) return [];

    // Total pagado por factura, en una sola consulta
    const sumas = await this.pagos
      .createQueryBuilder('p')
      .select('p.facturaId', 'facturaId')
      .addSelect('SUM(p.monto)', 'total')
      .where('p.facturaId IN (:...ids)', { ids: lista.map((f) => f.id) })
      .groupBy('p.facturaId')
      .getRawMany<{ facturaId: number; total: string }>();
    const pagado = new Map(sumas.map((s) => [Number(s.facturaId), cents(s.total)]));

    return lista.map((f) => ({
      id: f.id,
      numero: f.numero,
      cliente: f.cliente.nombre,
      fechaEmision: f.fechaEmision,
      fechaVencimiento: f.fechaVencimiento,
      montoTotal: Number(f.montoTotal),
      estado: f.estado,
      saldo: (cents(f.montoTotal) - (pagado.get(f.id) ?? 0)) / 100,
    }));
  }

  async obtenerFactura(id: number) {
    const factura = await this.facturas.findOne({ where: { id }, relations: { cliente: true } });
    if (!factura) throw new NotFoundException('Factura no encontrada');

    const pagos = await this.pagos.find({
      where: { facturaId: id },
      relations: { metodoPago: true },
      order: { fechaPago: 'ASC', id: 'ASC' },
    });
    const pagado = pagos.reduce((acc, p) => acc + cents(p.monto), 0);

    return {
      ...factura,
      pagos: pagos.map((p) => ({ id: p.id, fechaPago: p.fechaPago, monto: Number(p.monto), metodo: p.metodoPago.nombre })),
      saldo: (cents(factura.montoTotal) - pagado) / 100,
    };
  }
}