import { BadRequestException, Controller, Get, Injectable, Param, PipeTransform, Query, UseGuards } from '@nestjs/common';
import { FiltrosCuentaDto, FiltrosPagoDto } from './finanzas-v2.dto';
import { FinanzasV2Service } from './finanzas-v2.service';
import { ADMIN_PRUEBA, MockAdminGuard } from './mock-admin.guard';

@Injectable()
export class IdFinanzasPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) {
      throw new BadRequestException('El identificador debe ser un entero positivo válido.');
    }
    return value;
  }
}

@Controller('api/finanzas')
@UseGuards(MockAdminGuard)
export class FinanzasV2Controller {
  constructor(private readonly service: FinanzasV2Service) {}

  @Get('salud') salud() { return this.service.health(); }
  @Get('usuario') usuario() { return ADMIN_PRUEBA; }

  @Get('cuentas-cobrar') cuentasCobrar(@Query() f: FiltrosCuentaDto) { return this.service.listarCuentas('cobrar', f); }
  @Get('cuentas-cobrar/:id') cuentaCobrar(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerCuenta('cobrar', id); }

  @Get('cuentas-pagar') cuentasPagar(@Query() f: FiltrosCuentaDto) { return this.service.listarCuentas('pagar', f); }
  @Get('cuentas-pagar/:id') cuentaPagar(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerCuenta('pagar', id); }

  @Get('pagos') pagos(@Query() f: FiltrosPagoDto) { return this.service.listarPagos(f); }
  @Get('pagos/:id') pago(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerPago(id); }

  @Get('caja/saldo') saldo() { return this.service.saldo(); }
  @Get('movimientos') movimientos() { return this.service.movimientos(); }
}
