import { Module } from '@nestjs/common';
import { OutgoingPaymentsController } from './payments.controller';
import { OutgoingPaymentsService } from './payments.service';

@Module({
  controllers: [OutgoingPaymentsController],
  providers: [OutgoingPaymentsService],
})
export class OutgoingPaymentsModule {}

