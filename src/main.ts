import { NestFactory } from '@nestjs/core';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  // Ensure the SQLite data directory exists before TypeORM connects
  mkdirSync('data', { recursive: true });

  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
