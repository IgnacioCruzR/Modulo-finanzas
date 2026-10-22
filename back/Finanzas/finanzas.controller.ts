import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { CreateFacturaDto, CreatePagoDto } from './finanzas.dto';
import { FinanzasService } from './finanzas.service';

@Controller()
export class FinanzasController {
  constructor(private readonly service: FinanzasService) {}

  @Get('clientes')
  clientes() {
    return this.service.listarClientes();
  }

  @Get('metodos-pago')
  metodosPago() {
    return this.service.listarMetodosPago();
  }

  @Post('facturas')
  crearFactura(@Body() dto: CreateFacturaDto) {
    return this.service.crearFactura(dto);
  }

  @Get('facturas')
  listar(@Query('estado') estado?: string, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.service.listarFacturas(estado, desde, hasta);
  }

  @Get('facturas/:id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.obtenerFactura(id);
  }

  @Post('facturas/:id/pagos')
  registrarPago(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePagoDto) {
    return this.service.registrarPago(id, dto);
  }
}