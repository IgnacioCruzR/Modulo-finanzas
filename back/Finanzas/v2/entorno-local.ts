import { ConfigService } from '@nestjs/config';

export function esEntornoLocal(config: ConfigService): boolean {
  return ['local', 'test'].includes(config.get<string>('APP_ENV') ?? '')
    && config.get('DB_NAME') === 'erp_local'
    && ['localhost', '127.0.0.1', '::1', 'postgres', 'db'].includes(config.get<string>('DB_HOST') ?? '');
}
