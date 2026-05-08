import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { producerEnvSchema } from '@app/contracts';
import { RabbitMQModule } from '@app/rabbitmq';
import { EventsModule } from './modules/events/events.module';
import { HealthModule } from './modules/health/health.module';
import { OutboxModule } from './modules/outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: producerEnvSchema,
      validationOptions: { abortEarly: true },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    RabbitMQModule.forRoot({ enableConsumer: false }),
    OutboxModule,
    EventsModule,
    HealthModule,
  ],
})
export class ProducerAppModule {}
