import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private retryTimer?: NodeJS.Timeout;
  private stopped = false;
  private readonly pending = new Map<string, (success: boolean) => void>();

  /** Establish the broker connection without preventing API startup when unavailable. */
  async onModuleInit() {
    await this.connect();
  }

  /** Stop reconnecting and release broker resources on shutdown. */
  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    for (const finish of this.pending.values()) finish(false);
    await this.connection?.close().catch(() => undefined);
  }

  private scheduleReconnect() {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.connect();
    }, 5000);
  }

  private async connect() {
    let connection: amqp.ChannelModel | undefined;
    try {
      connection = await amqp.connect(
        process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
      );
      connection.on('error', () =>
        this.logger.error('RabbitMQ connection error'),
      );
      connection.on('close', () => {
        if (this.connection === connection) {
          this.channel = null;
          this.connection = null;
          for (const finish of this.pending.values()) finish(false);
        }
        this.scheduleReconnect();
      });
      const channel = await connection.createConfirmChannel();
      channel.on('error', () => this.logger.error('RabbitMQ channel error'));
      channel.on('close', () => {
        if (this.channel === channel) {
          this.channel = null;
          for (const finish of this.pending.values()) finish(false);
          void connection?.close().catch(() => undefined);
        }
      });
      channel.on('return', (msg: amqp.Message) => {
        const messageId: unknown = msg.properties.messageId;
        if (typeof messageId === 'string') this.pending.get(messageId)?.(false);
      });
      await channel.assertExchange('product_events', 'topic', {
        durable: true,
      });
      // Declare the target before the consumer starts so early messages are retained.
      await channel.assertQueue('search_product_sync_queue', { durable: true });
      await channel.bindQueue(
        'search_product_sync_queue',
        'product_events',
        'product.#',
      );
      if (this.stopped) {
        await connection.close();
        return;
      }
      this.connection = connection;
      this.channel = channel;
      this.logger.log('RabbitMQ publisher connected');
    } catch {
      await connection?.close().catch(() => undefined);
      this.logger.error('RabbitMQ connection failed; retrying in 5 seconds');
      this.scheduleReconnect();
    }
  }

  /** Resolve true only after a routed, persistent message receives a broker confirm. */
  publish(
    routingKey: string,
    message: { eventId: string; [key: string]: unknown },
  ): Promise<boolean> {
    const channel = this.channel;
    if (!channel) return Promise.resolve(false);
    return new Promise((resolve) => {
      // A unique publish ID avoids confusing retries after a timed-out confirm.
      const publishId = crypto.randomUUID();
      const finish = (success: boolean) => {
        if (!this.pending.delete(publishId)) return;
        clearTimeout(timer);
        resolve(success);
      };
      const timer = setTimeout(() => finish(false), 10000);
      this.pending.set(publishId, finish);
      try {
        // False means backpressure, not failure. The confirm callback is authoritative;
        // the processor awaits it before sending the next message.
        channel.publish(
          'product_events',
          routingKey,
          Buffer.from(JSON.stringify(message)),
          {
            persistent: true,
            mandatory: true,
            messageId: publishId,
            contentType: 'application/json',
            headers: { eventId: message.eventId },
          },
          (error) => finish(!error),
        );
      } catch {
        finish(false);
      }
    });
  }
}
