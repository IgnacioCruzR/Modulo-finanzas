import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, process.env.API_HOST ?? '127.0.0.1');
}
bootstrap().catch(() => {
  process.stderr.write('No se pudo iniciar la API. Revisa la configuración y los mensajes de NestJS.\n');
  process.exitCode = 1;
});
