import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/common/services/prisma.service';
import { RabbitMQService } from '@/common/services/rabbitmq.service';
import type { outbox_events } from 'generated/prisma/client';

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  /** Claim one event at a time with a lease; competing API instances skip locked rows. */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async processOutboxEvents() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      for (let i = 0; i < 50; i++) {
        const token = crypto.randomUUID();
        const events = await this.prisma.$queryRaw<outbox_events[]>`
          WITH candidate AS (
            SELECT id FROM outbox_events
            WHERE (status = 'PENDING' AND next_attempt_at <= CURRENT_TIMESTAMP)
               OR (status = 'PROCESSING' AND locked_until <= CURRENT_TIMESTAMP)
            ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1
          )
          UPDATE outbox_events e SET status = 'PROCESSING', lock_token = ${token}::uuid,
            locked_until = CURRENT_TIMESTAMP + INTERVAL '30 seconds', attempts = attempts + 1
          FROM candidate c WHERE e.id = c.id RETURNING e.*
        `;
        const event = events[0];
        if (!event) break;
        try {
          const success = await this.rabbitMQService.publish(
            `${event.aggregate_type}.${event.event_type.toLowerCase()}`,
            {
              eventId: event.id,
              aggregateType: event.aggregate_type,
              aggregateId: event.aggregate_id,
              eventType: event.event_type,
              eventVersion: Number(event.event_version),
              schemaVersion: 1,
              payload: event.payload,
              timestamp: event.created_at,
            },
          );
          if (!success)
            throw new Error('Broker did not confirm routed delivery');
          await this.prisma.outbox_events.updateMany({
            where: { id: event.id, status: 'PROCESSING', lock_token: token },
            data: {
              status: 'PROCESSED',
              processed_at: new Date(),
              locked_until: null,
              lock_token: null,
              last_error: null,
            },
          });
        } catch (error) {
          const delay = Math.min(
            300000,
            5000 * 2 ** Math.min(event.attempts - 1, 6),
          );
          const lastError =
            error instanceof Error ? error.message : String(error);
          await this.prisma.outbox_events.updateMany({
            where: { id: event.id, status: 'PROCESSING', lock_token: token },
            data: {
              status: 'PENDING',
              next_attempt_at: new Date(Date.now() + delay),
              locked_until: null,
              lock_token: null,
              last_error: lastError.slice(0, 2000),
            },
          });
          this.logger.warn(
            `Outbox ${event.id} attempt ${event.attempts}: ${lastError}`,
          );
        }
      }
    } catch (error) {
      this.logger.error('Error processing outbox events', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /** Log backlog health and remove at most 1000 confirmed events older than 30 days. */
  @Cron(CronExpression.EVERY_HOUR)
  async maintainOutbox() {
    try {
      const health = await this.prisma.$queryRaw`
        SELECT status, count(*)::int AS count, min(created_at) AS oldest
        FROM outbox_events WHERE status IN ('PENDING', 'PROCESSING') GROUP BY status
      `;
      this.logger.log(`Outbox backlog: ${JSON.stringify(health)}`);
      await this.prisma.$executeRaw`
        DELETE FROM outbox_events WHERE id IN (
          SELECT id FROM outbox_events WHERE status = 'PROCESSED'
            AND processed_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
          ORDER BY processed_at LIMIT 1000
        )
      `;
    } catch (error) {
      this.logger.error('Outbox maintenance failed', error);
    }
  }
}
