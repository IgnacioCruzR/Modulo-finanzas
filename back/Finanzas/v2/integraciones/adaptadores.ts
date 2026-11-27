import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { esEntornoLocal } from '../entorno-local';
import { AdaptadorReferencia, RecursoExterno } from './adaptador-referencia';
import { PuenteHttp } from './puente-http';

export const ADAPTADORES_REFERENCIAS = Symbol('ADAPTADORES_REFERENCIAS');
export type AdaptadoresReferencias = Readonly<Record<RecursoExterno, AdaptadorReferencia>>;

function idsDesde(inicio: number, cantidad: number): string[] {
  return Array.from({ length: cantidad }, (_, i) => String(inicio + i));
}

const FUENTES = {
  venta: { modulo: 'E-Commerce y Ventas', clave: 'INTEGRATION_VENTA', ids: ['101', ...idsDesde(5001, 10), ...idsDesde(7001, 12)] },
  orden_compra: { modulo: 'Compras', clave: 'INTEGRATION_ORDEN_COMPRA', ids: ['75', '7001', ...idsDesde(8001, 12)] },
  reembolso: { modulo: 'Postventa', clave: 'INTEGRATION_REEMBOLSO', ids: ['9001', '9002'] },
  usuario: { modulo: 'RRHH', clave: 'INTEGRATION_USUARIO', ids: ['1'] },
} as const;

export function modoIntegracion(config: ConfigService): string {
  return config.get<string>('INTEGRATION_MODE') ?? 'http';
}

function configurarAdaptador(config: ConfigService, fuente: typeof FUENTES[RecursoExterno]): AdaptadorReferencia {
  const modo = modoIntegracion(config);
  const seleccionado = config.get<string>(`${fuente.clave}_ADAPTER`) || (modo === 'local-fixtures' ? 'fixture' : 'pendiente');
  const noDisponible = (motivo: string): AdaptadorReferencia => ({
    async consultar() { throw new ServiceUnavailableException(`${fuente.modulo}: ${motivo}`); },
  });

  if (modo !== 'http' && modo !== 'local-fixtures') return noDisponible('modo de integración inválido.');
  if (modo === 'local-fixtures' && !esEntornoLocal(config)) return noDisponible('los fixtures requieren una base local de pruebas.');
  if (modo === 'local-fixtures' && seleccionado === 'fixture') {
    const ids = new Set<string>(fuente.ids);
    return { async consultar(id) { return ids.has(id) ? 'valida' : 'inexistente'; } };
  }
  if (seleccionado === 'http-bridge') {
    const url = config.get<string>(`${fuente.clave}_URL`);
    const timeout = Number(config.get('INTEGRATION_TIMEOUT_MS') ?? 5000);
    if (!url) return noDisponible('falta la URL del puente HTTP.');
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30000) return noDisponible('tiempo de espera inválido.');
    return new PuenteHttp(url, timeout);
  }
  return noDisponible('contrato de validación pendiente o adaptador sin configurar.');
}

export function crearAdaptadoresReferencias(config: ConfigService): AdaptadoresReferencias {
  return {
    venta: configurarAdaptador(config, FUENTES.venta),
    orden_compra: configurarAdaptador(config, FUENTES.orden_compra),
    reembolso: configurarAdaptador(config, FUENTES.reembolso),
    usuario: configurarAdaptador(config, FUENTES.usuario),
  };
}
