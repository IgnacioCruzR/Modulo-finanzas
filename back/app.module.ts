import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'node:path';
import { FinanzasV2Module } from './Finanzas/v2/finanzas-v2.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../.env')],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const schema = config.get<string>('DB_SCHEMA') ?? 'finanzas';
        if (schema !== 'finanzas') throw new Error('El modelo activo requiere DB_SCHEMA=finanzas.');
        for (const key of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']) {
          if (!config.get<string>(key)) throw new Error(`Falta configurar ${key}.`);
        }
        const port = Number(config.get('DB_PORT') ?? 5432);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('DB_PORT debe ser un puerto válido.');
        }
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port,
          database: config.get<string>('DB_NAME'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          schema, // esquema asignado por el profesor
          ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true, // toma las entidades registradas con forFeature
          synchronize: false, // las tablas las crea el script SQL, no el ORM
        };
      },
    }),
    // Se conserva el código anterior, pero no se registran sus rutas:
    // sus tablas no forman parte del modelo v2 aprobado.
    FinanzasV2Module,
  ],
})
export class AppModule {}
