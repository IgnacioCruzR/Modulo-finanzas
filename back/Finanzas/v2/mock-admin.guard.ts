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
    if (this.config.get('MOCK_AUTH_ENABLED') !== 'true'
      || this.config.get('APP_ENV') !== 'local'
      || !localHosts.includes(this.config.get<string>('DB_HOST') ?? '')
      || this.config.get('DB_NAME') !== 'erp_local') {
      throw new ForbiddenException('El administrador de prueba solo está habilitado para la base local erp_local.');
    }
    context.switchToHttp().getRequest().usuario = ADMIN_PRUEBA;
    return true;
  }
}
