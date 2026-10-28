import { Type, Transform } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, Matches, Max, MaxLength, ValidateIf } from 'class-validator';
const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
export const ESTADOS_OPERACION = ['pendiente', 'rechazada', 'ejecutada'] as const;
export const ESTADOS_CUENTA = ['pendiente', 'parcial', 'pagada', 'anulada'] as const;
export const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'simulado'] as const;
export class CrearCuentaDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9999999999999.99)
  monto_total!: number;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fecha_emision?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) @IsDateString({ strict: true })
  fecha_vencimiento?: string;
}
export class CrearCuentaCobrarDto extends CrearCuentaDto {
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) id_venta!: number;
}
export class CrearCuentaPagarDto extends CrearCuentaDto {
  @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) id_oc!: number;
}
export class FiltrosCuentaDto {
  @IsOptional() @IsIn(ESTADOS_CUENTA) estado?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) venta?: number;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) orden_compra?: number;
}
export class CrearOperacionDto {
  @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() @Max(9999999999999.99) monto!: number;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsIn(METODOS) metodo_pago?: string | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) id_cxc?: number | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) id_cxp?: number | null;
  @ValidateIf((_o, v) => v !== undefined && v !== null) @IsInt() @IsPositive() @Max(Number.MAX_SAFE_INTEGER) id_reembolso?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) descripcion?: string;
}
export class DecisionOperacionDto {
  @IsIn(['aprobada', 'rechazada']) decision!: 'aprobada' | 'rechazada';
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) observacion?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(METODOS) metodo_pago?: string;
}
export class FiltrosOperacionDto {
  @IsOptional() @IsIn(ESTADOS_OPERACION) estado?: string;
  @IsOptional() @IsIn(['cobro', 'proveedor', 'reembolso']) origen?: 'cobro' | 'proveedor' | 'reembolso';
}
