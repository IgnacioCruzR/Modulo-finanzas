import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export type RecursoExterno = 'venta' | 'orden_compra' | 'reembolso' | 'usuario';
// Fixtures de integración, NO maestros del ERP. Solo se habilitan en APP_ENV=local.
export const FIXTURES_EXTERNOS: Record<RecursoExterno, readonly string[]> = {
  venta: ['101', ...Array.from({ length: 10 }, (_, i) => String(5001 + i)), ...Array.from({ length: 12 }, (_, i) => String(7001 + i))],
  orden_compra: ['75', ...Array.from({ length: 12 }, (_, i) => String(8001 + i))],
  reembolso: ['9001', '9002'],
  usuario: ['1'],
};
@Injectable()
export class IntegracionExternaService {
  constructor(private readonly config: ConfigService) {}
  get modo() { return this.config.get<string>('INTEGRATION_MODE') ?? 'http'; }
  async validar(recurso: RecursoExterno, id: string | number): Promise<void> {
    const valor = String(id);
    if (!/^[1-9]\d*$/.test(valor) || BigInt(valor) > 9223372036854775807n) throw new BadRequestException('Referencia externa inválida.');
    if (this.modo === 'local-fixtures') {
      if (this.config.get('APP_ENV') !== 'local' || this.config.get('DB_NAME') !== 'erp_local') {
        throw new ServiceUnavailableException('Los fixtures externos solo están permitidos en la base local.');
      }
      if (!FIXTURES_EXTERNOS[recurso].includes(valor)) throw new BadRequestException('La referencia no existe en los fixtures de integración local.');
      return;
    }
    if (this.modo !== 'http') throw new ServiceUnavailableException('Modo de integración no configurado.');
    // Contrato del adaptador: GET URL/{id} -> {id: string, habilitada: boolean}.
    // Cada módulo acordará su endpoint; no se inventan tablas ni FK externas.
    const base = this.config.get<string>('INTEGRATION_' + recurso.toUpperCase() + '_URL');
    if (!base) throw new ServiceUnavailableException('Falta configurar el contrato del módulo externo.');
    let response: Response;
    try { response = await fetch(base.replace(/\/$/, '') + '/' + encodeURIComponent(valor), { signal: AbortSignal.timeout(5000), redirect: 'error' }); }
    catch { throw new ServiceUnavailableException('El módulo externo no está disponible.'); }
    if (response.status === 404) throw new BadRequestException('La referencia externa no existe.');
    if (!response.ok) throw new ServiceUnavailableException('El módulo externo no pudo validar la referencia.');
    const body = await response.json().catch(() => null) as { id?: unknown; habilitada?: unknown } | null;
    if (!body || body.id !== valor || typeof body.habilitada !== 'boolean') throw new ServiceUnavailableException('Respuesta externa incompatible con el contrato.');
    if (!body.habilitada) throw new BadRequestException('La referencia externa no está habilitada para esta operación.');
  }
}
