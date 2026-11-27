import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursoExterno } from './integraciones/adaptador-referencia';
import { ADAPTADORES_REFERENCIAS, AdaptadoresReferencias, modoIntegracion } from './integraciones/adaptadores';

@Injectable()
export class IntegracionExternaService {
  constructor(
    private readonly config: ConfigService,
    @Inject(ADAPTADORES_REFERENCIAS) private readonly adaptadores: AdaptadoresReferencias,
  ) {}

  get modo() { return modoIntegracion(this.config); }

  async validar(recurso: RecursoExterno, id: string | number): Promise<void> {
    const valor = String(id);
    if ((typeof id === 'number' && !Number.isSafeInteger(id))
      || !/^[1-9]\d{0,18}$/.test(valor) || BigInt(valor) > 9223372036854775807n) {
      throw new BadRequestException('Referencia externa inválida.');
    }

    const resultado = await this.adaptadores[recurso].consultar(valor);
    switch (resultado) {
      case 'valida': return;
      case 'invalida': throw new BadRequestException('Referencia externa inválida.');
      case 'inexistente': throw new BadRequestException('La referencia externa no existe.');
      case 'no_habilitada': throw new ConflictException('La referencia externa no está habilitada para esta operación.');
      default: throw new ServiceUnavailableException('Respuesta externa incompatible con el contrato.');
    }
  }
}
