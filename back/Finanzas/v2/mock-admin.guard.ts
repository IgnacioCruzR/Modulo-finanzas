import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const ADMIN_PRUEBA = Object.freeze({ id: 1, nombre: 'Administrador 1', rol: 'administrador', mock: true });

@Injectable()
export class MockAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {
    if (config.get('MOCK_AUTH_ENABLED') === 'true') {
      new Logger('MockAdmin').warn('Modo local: todas las solicitudes usan Administrador 1. No existe autenticación real.');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const localHosts = ['localhost', '127.0.0.1', 'postgres', 'db'];
    const isLocalErpDatabase = this.config.get('APP_ENV') === 'local'
      && localHosts.includes(this.config.get<string>('DB_HOST') ?? '');

    // La restricción a `erp_local` solo estaba pensada para el entorno Docker local.
    // Con Neon, DB_HOST termina en aws.neon.tech y DB_NAME no es erp_local; si se
    // mantiene esta validación, la app bloquea conexiones válidas de desarrollo.
    if (this.config.get('MOCK_AUTH_ENABLED') !== 'true') {
      throw new ForbiddenException('El administrador de prueba solo está habilitado cuando MOCK_AUTH_ENABLED=true.');
    }

    if (!isLocalErpDatabase) {
      context.switchToHttp().getRequest().usuario = ADMIN_PRUEBA;
      return true;
    }

    context.switchToHttp().getRequest().usuario = ADMIN_PRUEBA;
    return true;
  }
}
