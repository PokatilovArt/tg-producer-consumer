import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { NotificationAppModule } from './notification-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(NotificationAppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
}

void bootstrap();
