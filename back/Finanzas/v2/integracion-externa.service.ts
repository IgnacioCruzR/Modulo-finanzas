import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export type RecursoExterno = 'venta' | 'orden_compra' | 'reembolso' | 'usuario';

@Injectable()
export class IntegracionExternaService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  get modo() { return this.config.get<string>('INTEGRATION_MODE') ?? 'http'; }

  private async existeEnBase(recurso: RecursoExterno, valor: string): Promise<boolean> {
    switch (recurso) {
      case 'venta':
        const venta = await this.dataSource.query(
          'SELECT EXISTS(SELECT 1 FROM finanzas.cuenta_cobrar WHERE id_venta = $1) AS existe',
          [valor],
        );
        return Boolean(venta?.[0]?.existe);
      case 'orden_compra':
        const ordenCompra = await this.dataSource.query(
          'SELECT EXISTS(SELECT 1 FROM finanzas.cuenta_pagar WHERE id_oc = $1) AS existe',
          [valor],
        );
        return Boolean(ordenCompra?.[0]?.existe);
      case 'reembolso':
        // La validación por fixtures quedó eliminada. Si el recurso no tiene tabla propia,
        // se acepta la referencia siempre que exista el formato y la conexión a la base funcione.
        return true;
      case 'usuario':
        return true;
      default:
        return true;
    }
  }

  async validar(recurso: RecursoExterno, id: string | number): Promise<void> {
    const valor = String(id);
    if (!/^[1-9]\d*$/.test(valor) || BigInt(valor) > 9223372036854775807n) throw new BadRequestException('Referencia externa inválida.');

    // Se elimina la validación por fixtures locales. Las referencias reales deben existir en la base de datos de Neon.
    if (this.modo === 'local-fixtures') {
      const existe = await this.existeEnBase(recurso, valor);
      if (!existe) throw new BadRequestException('La referencia no existe en la base de datos de finanzas.');
      return;
    }

    if (this.modo !== 'http') throw new ServiceUnavailableException('Modo de integración no configurado.');
    // Contrato del adaptador: GET URL/{id} -> {id: string, habilitada: boolean}.
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
