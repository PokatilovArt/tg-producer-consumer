import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { NotificationEventType } from '@app/contracts';
import { EventsModule } from '../src/modules/events/events.module';
import { EVENT_PUBLISHER } from '../src/modules/events/application/event-publisher.port';

describe('POST /events (e2e)', () => {
  let app: INestApplication;
  const publish = jest.fn().mockResolvedValue(undefined);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
    })
      .overrideProvider(EVENT_PUBLISHER)
      .useValue({ publish })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid event and returns 202', async () => {
    const response = await request(app.getHttpServer())
      .post('/events')
      .send({
        type: NotificationEventType.TELEGRAM_MESSAGE,
        payload: { text: 'hello world' },
      })
      .expect(202);

    expect(response.body.status).toBe('accepted');
    expect(response.body.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(publish).toHaveBeenCalled();
  });

  it('rejects missing payload with 400', async () => {
    await request(app.getHttpServer())
      .post('/events')
      .send({ type: NotificationEventType.TELEGRAM_MESSAGE })
      .expect(400);
  });
});
