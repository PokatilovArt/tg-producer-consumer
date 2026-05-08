import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ProducerAppModule } from './producer-app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ProducerAppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('FinSolutions — Producer Service')
    .setDescription('Publishes notification events to RabbitMQ.')
    .setVersion('1.0.0')
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, swagger));

  const config = app.get(ConfigService);
  const port = Number(config.get<number>('PRODUCER_PORT', 3000));
  await app.listen(port);
}

void bootstrap();
