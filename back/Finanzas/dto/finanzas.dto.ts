import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, MaxLength, Min } from 'class-validator';

export class CreateFacturaDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  numero!: string;

  @IsInt() @Min(1)
  clienteId!: number;

  @IsDateString()
  fechaEmision!: string;

  @IsDateString()
  fechaVencimiento!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  montoTotal!: number;
}

export class CreatePagoDto {
  @IsInt() @Min(1)
  metodoPagoId!: number;

  @IsDateString()
  fechaPago!: string;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  monto!: number;
}