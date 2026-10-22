import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanzasModule } from './finanzas/finanzas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const schema = config.get<string>('DB_SCHEMA') ?? 'finanzas';
        return {
          type: 'postgres' as const,
          host: config.get<string>('DB_HOST'),
          port: Number(config.get('DB_PORT') ?? 5432),
          database: config.get<string>('DB_NAME'),
          username: config.get<string>('DB_USER'),
          password: config.get<string>('DB_PASSWORD'),
          schema, // esquema asignado por el profesor
          ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true, // toma las entidades registradas con forFeature
          synchronize: false, // las tablas las crea el script SQL, no el ORM
          extra: { options: `-c search_path=${schema}` },
        };
      },
    }),
    FinanzasModule,
  ],
})
export class AppModule {}