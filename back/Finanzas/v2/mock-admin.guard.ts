import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { esEntornoLocal } from './entorno-local';

export const ADMIN_PRUEBA = Object.freeze({ id: 1, nombre: 'Administrador 1', rol: 'administrador', mock: true });

@Injectable()
export class MockAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {
    if (this.habilitado) {
      new Logger('MockAdmin').warn('Modo local: todas las solicitudes usan Administrador 1. No existe autenticación real.');
    }
  }

  get habilitado(): boolean {
    return this.config.get('MOCK_AUTH_ENABLED') === 'true' && esEntornoLocal(this.config);
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.habilitado) {
      throw new ForbiddenException('El administrador de prueba requiere habilitación explícita y una base local de pruebas.');
    }

    context.switchToHttp().getRequest().usuario = ADMIN_PRUEBA;
    return true;
  }
}
