import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanzasController } from './finanzas.controller';
import { Cliente, Factura, MetodoPago, Pago } from './finanzas.entities';
import { FinanzasService } from './finanzas.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, MetodoPago, Factura, Pago])],
  controllers: [FinanzasController],
  providers: [FinanzasService],
})
export class FinanzasModule {}