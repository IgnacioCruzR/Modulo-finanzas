import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateFacturaDto, CreatePagoDto } from './dto/finanzas.dto';
import { FinanzasService } from './finanzas.service';
import { Role } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class FinanzasController {
  constructor(private readonly service: FinanzasService) {}

  @Get('clientes')
  @Roles(Role.ADMIN, Role.CAJERO)
  clientes() {
    return this.service.listarClientes();
  }

  @Get('metodos-pago')
  @Roles(Role.ADMIN, Role.CAJERO)
  metodosPago() {
    return this.service.listarMetodosPago();
  }

  @Post('facturas')
  @Roles(Role.ADMIN, Role.CAJERO)
  crearFactura(@Body() dto: CreateFacturaDto) {
    return this.service.crearFactura(dto);
  }

  @Get('facturas')
  @Roles(Role.ADMIN, Role.CAJERO)
  listar(@Query('estado') estado?: string, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.listarFacturas(estado, desde, hasta);
  }

  @Get('facturas/:id')
  @Roles(Role.ADMIN, Role.CAJERO)
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerFactura(id);
  }

  @Post('facturas/:id/pagos')
  @Roles(Role.ADMIN, Role.CAJERO)
  registrarPago(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePagoDto) {
    return this.service.registrarPago(id, dto);
  }
}