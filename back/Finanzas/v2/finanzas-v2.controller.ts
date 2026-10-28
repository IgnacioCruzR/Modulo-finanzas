import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Param, PipeTransform, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CrearCuentaCobrarDto, CrearCuentaPagarDto, CrearOperacionDto, DecisionOperacionDto, FiltrosCuentaDto, FiltrosOperacionDto } from './finanzas-v2.dto';
import { FinanzasV2Service } from './finanzas-v2.service';
import { ADMIN_PRUEBA, MockAdminGuard } from './mock-admin.guard';
@Injectable()
export class IdFinanzasPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new BadRequestException('El identificador debe ser un entero positivo válido.');
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
  @Post('cuentas-cobrar') crearCuentaCobrar(@Body() d: CrearCuentaCobrarDto) { return this.service.crearCuenta('cobrar', d); }
  @Get('cuentas-pagar') cuentasPagar(@Query() f: FiltrosCuentaDto) { return this.service.listarCuentas('pagar', f); }
  @Get('cuentas-pagar/:id') cuentaPagar(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerCuenta('pagar', id); }
  @Post('cuentas-pagar') crearCuentaPagar(@Body() d: CrearCuentaPagarDto) { return this.service.crearCuenta('pagar', d); }
  @Get('operaciones') operaciones(@Query() f: FiltrosOperacionDto) { return this.service.listarOperaciones(f); }
  @Get('operaciones/:id') operacion(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerOperacion(id); }
  @Post('operaciones') crearOperacion(@Body() d: CrearOperacionDto) { return this.service.crearOperacion(d); }
  @Post('operaciones/:id/decision') @HttpCode(200)
  decidir(@Param('id', IdFinanzasPipe) id: string, @Body() d: DecisionOperacionDto, @Req() req: { usuario: typeof ADMIN_PRUEBA }) {
    return this.service.decidirOperacion(id, d, req.usuario.id);
  }
  @Get('caja/saldo') saldo() { return this.service.saldo(); }
  @Get('movimientos') movimientos() { return this.service.movimientos(); }
}
