import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsInfrastructureModule } from '../events/events-infrastructure.module';
import { OUTBOX_REPOSITORY } from './application/outbox-repository.port';
import { OutboxRelayWorker } from './application/outbox-relay.worker';
import { pgPoolProvider } from './infrastructure/postgres.provider';
import { PostgresOutboxRepository } from './infrastructure/postgres-outbox.repository';

@Global()
@Module({
  imports: [ConfigModule, EventsInfrastructureModule],
  providers: [
    pgPoolProvider,
    {
      provide: OUTBOX_REPOSITORY,
      useClass: PostgresOutboxRepository,
    },
    OutboxRelayWorker,
  ],
  exports: [OUTBOX_REPOSITORY, pgPoolProvider],
})
export class OutboxModule {}
