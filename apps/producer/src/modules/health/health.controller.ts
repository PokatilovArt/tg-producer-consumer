import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  MicroserviceHealthIndicator,
} from '@nestjs/terminus';
import { Pool } from 'pg';
import { PG_POOL } from '../outbox/infrastructure/postgres.provider';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly microservice: MicroserviceHealthIndicator,
    private readonly config: ConfigService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<{ status: string }> {
    return this.health.check([
      (): Promise<HealthIndicatorResult> =>
        this.microservice.pingCheck('rabbitmq', {
          transport: Transport.RMQ,
          options: { urls: [this.config.getOrThrow<string>('RABBITMQ_URL')] },
        }),
      async (): Promise<HealthIndicatorResult> => {
        await this.pool.query('SELECT 1');
        return { postgres: { status: 'up' } };
      },
    ]);
  }
}
