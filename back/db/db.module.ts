import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT ?? 5432),
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
          // Las consultas usan nombres sin esquema: se resuelven en el esquema de Finanzas
          options: `-c search_path=${process.env.DB_SCHEMA ?? 'finanzas'}`,
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DbModule {}