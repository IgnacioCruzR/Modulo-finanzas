import { ServiceUnavailableException } from '@nestjs/common';
import { AdaptadorReferencia, ResultadoReferencia } from './adaptador-referencia';

export class PuenteHttp implements AdaptadorReferencia {
  constructor(private readonly base: string, private readonly timeoutMs: number) {}

  async consultar(id: string): Promise<ResultadoReferencia> {
    const url = URL.parse(this.base);
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new ServiceUnavailableException('URL de integración inválida.');
    }
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(id)}`;

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new ServiceUnavailableException('El módulo externo no está disponible.');
    }

    if (respuesta.status !== 200) {
      void respuesta.body?.cancel().catch(() => undefined);
      if (respuesta.status === 400) return 'invalida';
      if (respuesta.status === 404) return 'inexistente';
      if (respuesta.status === 409) return 'no_habilitada';
      throw new ServiceUnavailableException('El módulo externo no pudo validar la referencia.');
    }

    const tipo = respuesta.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (tipo !== 'application/json') {
      void respuesta.body?.cancel().catch(() => undefined);
      throw new ServiceUnavailableException('Respuesta externa incompatible con el contrato.');
    }
    const body: unknown = await respuesta.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('id' in body) || body.id !== id
      || !('habilitada' in body) || typeof body.habilitada !== 'boolean') {
      throw new ServiceUnavailableException('Respuesta externa incompatible con el contrato.');
    }
    return body.habilitada ? 'valida' : 'no_habilitada';
  }
}
