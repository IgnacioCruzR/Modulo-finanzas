import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from './db/db.module';
import { FinanzasModule } from './Finanzas/finanzas.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, FinanzasModule],
})
export class AppModule {}