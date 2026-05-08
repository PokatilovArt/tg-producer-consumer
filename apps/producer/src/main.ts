import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ProducerAppModule } from './producer-app.module';

const SWAGGER_PATH = 'api';
const SWAGGER_TITLE = 'FinSolutions — Producer Service';
const SWAGGER_DESCRIPTION = 'Publishes notification events to RabbitMQ.';
const SWAGGER_VERSION = '1.0.0';
const DEFAULT_PORT = 3000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ProducerAppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion(SWAGGER_VERSION)
    .build();
  SwaggerModule.setup(SWAGGER_PATH, app, SwaggerModule.createDocument(app, swagger));

  const config = app.get(ConfigService);
  const port = Number(config.get<number>('PRODUCER_PORT', DEFAULT_PORT));
  await app.listen(port);
}

void bootstrap();
