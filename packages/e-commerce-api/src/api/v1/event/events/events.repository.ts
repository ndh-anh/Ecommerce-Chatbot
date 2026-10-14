import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/common/services/prisma.service';
import type { Prisma, events } from 'generated/prisma/client';
import type {
  PostEventBody,
  GetEventsQueryParams,
} from '@e-commerce/api-validation/types/event';
import { randomUUID } from 'crypto';

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Read a bounded page with a deterministic order and optional public visibility filter. */
  async list(
    query: GetEventsQueryParams,
    publicOnly = false,
  ): Promise<{ events: events[]; totalCount: number; totalPages: number }> {
    const where: Prisma.eventsWhereInput = {
      ...(publicOnly ? { is_published: true } : {}),
      ...(query.title
        ? { title: { contains: query.title, mode: 'insensitive' } }
        : {}),
    };
    const fields = {
      title: 'title',
      startsAt: 'starts_at',
      endsAt: 'ends_at',
      sortOrder: 'sort_order',
      createdAt: 'created_at',
    } as const;
    const orderBy: Prisma.eventsOrderByWithRelationInput[] = query.orderBy
      ? query.orderBy.split(',').map((sort) => {
          const [field, direction] = sort.split(':');
          if (!(field in fields) || !['asc', 'desc'].includes(direction))
            throw new BadRequestException('Thứ tự sắp xếp không hợp lệ.');
          return { [fields[field as keyof typeof fields]]: direction };
        })
      : [{ sort_order: 'asc' }, { starts_at: 'desc' }];
    orderBy.push({ id: 'asc' });
    const [events, totalCount] = await this.prisma.$transaction([
      this.prisma.events.findMany({
        where,
        orderBy,
        take: query.pageSize,
        skip: (query.page - 1) * query.pageSize,
      }),
      this.prisma.events.count({ where }),
    ]);
    return {
      events,
      totalCount,
      totalPages: Math.ceil(totalCount / query.pageSize),
    };
  }

  /** Only active published events opted into the carousel can appear on the homepage. */
  carousel(now: Date): Prisma.PrismaPromise<events[]> {
    return this.prisma.events.findMany({
      where: {
        is_published: true,
        show_on_carousel: true,
        starts_at: { lte: now },
        ends_at: { gt: now },
      },
      orderBy: [{ sort_order: 'asc' }, { starts_at: 'desc' }, { id: 'asc' }],
      take: 20,
    });
  }

  /** Return admin details or a published public event, otherwise respond with 404. */
  async find(
    key: { id: string } | { slug: string },
    publicOnly = false,
  ): Promise<events> {
    const event = await this.prisma.events.findFirst({
      where: { ...key, ...(publicOnly ? { is_published: true } : {}) },
    });
    if (!event) throw new NotFoundException('Không tìm thấy sự kiện.');
    return event;
  }

  private data(input: PostEventBody): Omit<Prisma.eventsCreateInput, 'id'> {
    return {
      title: input.title,
      slug: input.slug,
      thumbnail_url: input.thumbnailUrl,
      description: input.description,
      summary: input.summary ?? '',
      starts_at: new Date(input.startsAt),
      ends_at: new Date(input.endsAt),
      is_published: input.isPublished ?? false,
      show_on_carousel: input.showOnCarousel ?? true,
      sort_order: input.sortOrder ?? 0,
    };
  }

  /** Create an event; the database enforces slug uniqueness and a valid date range. */
  create(input: PostEventBody): Prisma.PrismaPromise<events> {
    return this.prisma.events.create({
      data: { id: randomUUID(), ...this.data(input) },
    });
  }

  /** Persist a complete validated event after merging a partial update. */
  update(id: string, input: PostEventBody): Prisma.PrismaPromise<events> {
    return this.prisma.events.update({ where: { id }, data: this.data(input) });
  }

  /** Remove a single event after the admin confirms deletion. */
  async delete(id: string): Promise<void> {
    await this.prisma.events.delete({ where: { id } });
  }
}
