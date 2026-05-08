import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { NotificationAppModule } from './notification-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(NotificationAppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.get(Logger).log(`received ${signal}, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

void bootstrap();
