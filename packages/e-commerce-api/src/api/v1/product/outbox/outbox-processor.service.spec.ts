import { OutboxProcessorService } from './outbox-processor.service';
import { PrismaService } from '@/common/services/prisma.service';
import { RabbitMQService } from '@/common/services/rabbitmq.service';
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: {
    EVERY_5_SECONDS: '*/5 * * * * *',
    EVERY_HOUR: '0 0 * * * *',
  },
}));
jest.mock('@/common/services/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

describe('OutboxProcessorService', () => {
  const event = {
    id: 'event',
    aggregate_type: 'product',
    aggregate_id: 'product',
    event_type: 'updated',
    payload: {},
    event_version: 1000000000001n,
    created_at: new Date(),
    attempts: 2,
  };
  let prisma: any;
  let broker: any;
  let service: OutboxProcessorService;
  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockResolvedValueOnce([event]).mockResolvedValue([]),
      outbox_events: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    broker = { publish: jest.fn().mockResolvedValue(true) };
    service = new OutboxProcessorService(
      prisma as PrismaService,
      broker as RabbitMQService,
    );
  });
  it('waits for broker confirmation and uses the lease token when marking processed', async () => {
    let confirm!: (value: boolean) => void;
    broker.publish.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const work = service.processOutboxEvents();
    await Promise.resolve();
    expect(prisma.outbox_events.updateMany).not.toHaveBeenCalled();
    confirm(true);
    await work;
    expect(broker.publish).toHaveBeenCalledWith(
      'product.updated',
      expect.objectContaining({
        eventVersion: 1000000000001,
        schemaVersion: 1,
      }),
    );
    expect(prisma.outbox_events.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'event',
          status: 'PROCESSING',
          lock_token: expect.any(String),
        }),
        data: expect.objectContaining({
          status: 'PROCESSED',
          processed_at: expect.any(Date),
          lock_token: null,
        }),
      }),
    );
  });
  it('persists backoff and errors when broker confirmation fails', async () => {
    broker.publish.mockResolvedValue(false);
    const before = Date.now();
    await service.processOutboxEvents();
    const data = prisma.outbox_events.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('PENDING');
    expect(data.next_attempt_at.getTime()).toBeGreaterThanOrEqual(
      before + 10000,
    );
    expect(data.last_error).toContain('Broker');
    expect(data.lock_token).toBeNull();
  });
  it('continues with later events after an individual publish throws', async () => {
    prisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([event])
      .mockResolvedValueOnce([{ ...event, id: 'event2' }])
      .mockResolvedValue([]);
    broker.publish
      .mockRejectedValueOnce(new Error('disconnected'))
      .mockResolvedValueOnce(true);
    await service.processOutboxEvents();
    expect(
      prisma.outbox_events.updateMany.mock.calls.map(
        (call: [{ data: { status: string } }]) => call[0].data.status,
      ),
    ).toEqual(['PENDING', 'PROCESSED']);
  });
  it('prevents overlapping cron runs within an instance and resumes afterwards', async () => {
    let confirm!: (value: boolean) => void;
    broker.publish.mockImplementation(
      () =>
        new Promise((resolve) => {
          confirm = resolve;
        }),
    );
    const work = service.processOutboxEvents();
    await Promise.resolve();
    await service.processOutboxEvents();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    confirm(true);
    await work;
    await service.processOutboxEvents();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
  });
});
