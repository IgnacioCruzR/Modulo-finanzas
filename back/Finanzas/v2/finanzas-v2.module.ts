import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTIDADES_V2 } from './finanzas-v2.entities';
import { FinanzasV2Controller, FinanzasSaludController, IdFinanzasPipe } from './finanzas-v2.controller';
import { FinanzasV2Service } from './finanzas-v2.service';
import { MockAdminGuard } from './mock-admin.guard';
import { IntegracionExternaService } from './integracion-externa.service';
import { ADAPTADORES_REFERENCIAS, crearAdaptadoresReferencias } from './integraciones/adaptadores';

@Module({
  imports: [TypeOrmModule.forFeature(ENTIDADES_V2)],
  controllers: [FinanzasV2Controller, FinanzasSaludController],
  providers: [
    FinanzasV2Service, MockAdminGuard, IdFinanzasPipe, IntegracionExternaService,
    { provide: ADAPTADORES_REFERENCIAS, inject: [ConfigService], useFactory: crearAdaptadoresReferencias },
  ],
})
export class FinanzasV2Module {}
