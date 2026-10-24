import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTIDADES_V2 } from './finanzas-v2.entities';
import { FinanzasV2Controller, IdFinanzasPipe } from './finanzas-v2.controller';
import { FinanzasV2Service } from './finanzas-v2.service';
import { MockAdminGuard } from './mock-admin.guard';

@Module({
  imports: [TypeOrmModule.forFeature(ENTIDADES_V2)],
  controllers: [FinanzasV2Controller],
  providers: [FinanzasV2Service, MockAdminGuard, IdFinanzasPipe],
})
export class FinanzasV2Module {}
