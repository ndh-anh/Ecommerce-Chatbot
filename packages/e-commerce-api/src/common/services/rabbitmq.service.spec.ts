import { EventEmitter } from 'node:events';
import * as amqp from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';
jest.mock('amqplib', () => ({ connect: jest.fn() }));

describe('RabbitMQService publisher confirms', () => {
  let channel: any;
  let connection: any;
  let service: RabbitMQService;
  let callback: (error: Error | null) => void;
  beforeEach(async () => {
    channel = Object.assign(new EventEmitter(), {
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      publish: jest.fn((_exchange, _key, _body, _options, cb) => {
        callback = cb;
        return false;
      }),
    });
    connection = Object.assign(new EventEmitter(), {
      createConfirmChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
    });
    (amqp.connect as jest.Mock).mockResolvedValue(connection);
    service = new RabbitMQService();
    await service.onModuleInit();
  });
  afterEach(async () => {
    await service.onModuleDestroy();
  });
  it('treats backpressure as pending and succeeds only on confirm', async () => {
    const sent = service.publish('product.updated', { eventId: 'event' });
    callback(null);
    await expect(sent).resolves.toBe(true);
    expect(channel.publish.mock.calls[0][3]).toEqual(
      expect.objectContaining({ persistent: true, mandatory: true }),
    );
  });
  it('rejects an unroutable message even when broker acknowledges it', async () => {
    const sent = service.publish('product.updated', { eventId: 'event' });
    channel.emit('return', {
      properties: { messageId: channel.publish.mock.calls[0][3].messageId },
    });
    callback(null);
    await expect(sent).resolves.toBe(false);
  });
  it('fails broker nacks', async () => {
    const sent = service.publish('product.updated', { eventId: 'event' });
    callback(new Error('nack'));
    await expect(sent).resolves.toBe(false);
  });
  it('releases pending publishes on connection loss', async () => {
    const sent = service.publish('product.updated', { eventId: 'event' });
    connection.emit('close');
    await expect(sent).resolves.toBe(false);
    await expect(
      service.publish('product.updated', { eventId: 'next' }),
    ).resolves.toBe(false);
  });
});
