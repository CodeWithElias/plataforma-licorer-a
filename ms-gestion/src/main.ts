import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// Fuera de Docker lee las variables de .env (en Docker no existe y se usan las del compose)
try {
  process.loadEnvFile();
} catch {
  // sin .env
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Orígenes permitidos para CORS, separados por coma (vacío = sin CORS; detrás de Nginx no hace falta)
  const origenes = (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (origenes.length) app.enableCors({ origin: origenes });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
await bootstrap();
