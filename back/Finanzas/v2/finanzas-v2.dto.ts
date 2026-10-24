import { Type, Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
// Se conservan los DTO de escritura como contrato de referencia para el equipo.
// Los POST y su lógica transaccional están pendientes de implementación.
export const OPERACIONES = ['cobro', 'proveedor', 'nomina', 'reembolso'] as const;
export const ESTADOS_PAGO = ['pendiente', 'aprobado', 'rechazado', 'ejecutado'] as const;
export const ESTADOS_CUENTA = ['pendiente', 'parcial', 'pagada', 'anulada'] as const;

export class CrearCuentaDto {
  @IsInt() @IsPositive() @Max(32767)
  cantidad_cuotas: number = 1;

  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9999999999999.99)
  monto_total!: number;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fecha_emision?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fecha_vencimiento?: string;
}

export class CrearCuentaCobrarDto extends CrearCuentaDto {
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_venta!: number;
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_cliente!: number;
}

export class CrearCuentaPagarDto extends CrearCuentaDto {
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_oc!: number;
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_proveedor!: number;
}

export class FiltrosCuentaDto {
  @IsOptional() @IsIn(ESTADOS_CUENTA)
  estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  venta?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  orden_compra?: number;
}

export class CrearPagoDto {
  @IsIn(OPERACIONES)
  tipo_operacion!: typeof OPERACIONES[number];
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9999999999999.99)
  monto!: number;
  @IsIn(['efectivo', 'transferencia', 'tarjeta', 'simulado'])
  metodo_pago!: string;

  @IsOptional() @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_cxc?: number;
  @IsOptional() @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_cxp?: number;
  @IsOptional() @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_empleado?: number;
  @IsOptional() @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_nomina?: number;
  @IsOptional() @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER)
  id_reembolso?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  descripcion?: string;
}

export class DecisionPagoDto {
  @IsIn(['aprobada', 'rechazada'])
  decision!: 'aprobada' | 'rechazada';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000)
  observacion?: string;
}

export class FiltrosPagoDto {
  @IsOptional() @IsIn(ESTADOS_PAGO)
  estado?: string;
  @IsOptional() @IsIn(OPERACIONES)
  tipo_operacion?: string;
}
