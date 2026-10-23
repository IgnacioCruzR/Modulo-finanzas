import {
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOutgoingPaymentDto {
  @IsInt()
  @IsPositive()
  obligationId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @IsIn(['Transferencia bancaria', 'Efectivo', 'Cheque', 'Otro'])
  method!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  bankReference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
