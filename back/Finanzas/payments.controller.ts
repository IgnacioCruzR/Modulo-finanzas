import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOutgoingPaymentDto } from './payments.dto';
import { OutgoingPaymentsService } from './payments.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('payments')
export class OutgoingPaymentsController {
  constructor(private readonly service: OutgoingPaymentsService) {}

  @Get('obligations')
  listObligations(@Query('origin') origin?: string) {
    return this.service.listObligations(origin);
  }

  @Get('summary')
  summary() {
    return this.service.getSummary();
  }

  @Get()
  listPayments() {
    return this.service.listPayments();
  }

  @Get(':id')
  getPayment(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPayment(id);
  }

  @Post()
  createPayment(
    @Body() dto: CreateOutgoingPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!idempotencyKey || !UUID.test(idempotencyKey)) {
      throw new BadRequestException('Se requiere una clave de idempotencia UUID válida.');
    }
    return this.service.createPayment(dto, idempotencyKey);
  }
}

