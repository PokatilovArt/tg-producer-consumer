import { ValidationPipe } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationEventType } from '@app/contracts';
import { EventsModule } from '../src/modules/events/events.module';
import { OUTBOX_REPOSITORY } from '../src/modules/outbox/application/outbox-repository.port';

describe('POST /events (e2e)', () => {
  let app: INestApplication;
  const enqueue = jest.fn().mockResolvedValue(true);
  const withClaimedBatch = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
        EventsModule,
      ],
      providers: [
        {
          provide: OUTBOX_REPOSITORY,
          useValue: { enqueue, withClaimedBatch },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid event and enqueues to outbox', async () => {
    const response = await request(app.getHttpServer())
      .post('/events')
      .send({
        type: NotificationEventType.TELEGRAM_MESSAGE,
        payload: { text: 'hello world' },
      })
      .expect(202);

    expect(response.body.status).toBe('accepted');
    expect(response.body.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(enqueue).toHaveBeenCalled();
  });

  it('rejects missing payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({ type: NotificationEventType.TELEGRAM_MESSAGE })
      .expect(400);
  });
});
