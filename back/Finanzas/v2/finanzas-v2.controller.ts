import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Param, PipeTransform, Post, Query, Req } from '@nestjs/common';
import { CrearCuentaCobrarDto, CrearCuentaPagarDto, CrearOperacionDto, DecisionOperacionDto, FiltrosCuentaDto, FiltrosOperacionDto } from './finanzas-v2.dto';
import { FinanzasV2Service } from './finanzas-v2.service';
import { Public } from '../../auth/public.decorator';
import { Role } from '../../auth/roles.enum';
import { Roles } from '../../auth/roles.decorator';
@Injectable()
export class IdFinanzasPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[1-9]\d{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new BadRequestException('El identificador debe ser un entero positivo válido.');
    return value;
  }
}
@Controller('api/finanzas')
export class FinanzasV2Controller {
  constructor(private readonly service: FinanzasV2Service) {}
  @Public()
  @Get('salud') salud() { return this.service.health(); }
  @Roles(Role.ADMIN)
  @Get('usuario') usuario(@Req() req: { user: { id: number; username: string; email: string; role: Role } }) { return req.user; }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('cuentas-cobrar') cuentasCobrar(@Query() f: FiltrosCuentaDto) { return this.service.listarCuentas('cobrar', f); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('cuentas-cobrar/:id') cuentaCobrar(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerCuenta('cobrar', id); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Post('cuentas-cobrar') crearCuentaCobrar(@Body() d: CrearCuentaCobrarDto) { return this.service.crearCuenta('cobrar', d); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('cuentas-pagar') cuentasPagar(@Query() f: FiltrosCuentaDto) { return this.service.listarCuentas('pagar', f); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('cuentas-pagar/:id') cuentaPagar(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerCuenta('pagar', id); }
  @Roles(Role.ADMIN)
  @Post('cuentas-pagar') crearCuentaPagar(@Body() d: CrearCuentaPagarDto) { return this.service.crearCuenta('pagar', d); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('operaciones') operaciones(@Query() f: FiltrosOperacionDto) { return this.service.listarOperaciones(f); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('operaciones/:id') operacion(@Param('id', IdFinanzasPipe) id: string) { return this.service.obtenerOperacion(id); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Post('operaciones') crearOperacion(@Body() d: CrearOperacionDto) { return this.service.crearOperacion(d); }
  @Roles(Role.ADMIN)
  @Post('operaciones/:id/decision') @HttpCode(200)
  decidir(@Param('id', IdFinanzasPipe) id: string, @Body() d: DecisionOperacionDto, @Req() req: { user: { id: number } }) {
    return this.service.decidirOperacion(id, d, req.user.id);
  }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('caja/saldo') saldo() { return this.service.saldo(); }
  @Roles(Role.ADMIN, Role.CAJERO)
  @Get('movimientos') movimientos() { return this.service.movimientos(); }
}
