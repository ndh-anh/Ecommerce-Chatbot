import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import { PrismaService } from '@/common/services/prisma.service';

describe('EventsRepository visibility and pagination', () => {
  let repository: EventsRepository;
  let findMany: jest.Mock;
  let findFirst: jest.Mock;
  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      events: { findMany, findFirst, count: jest.fn().mockResolvedValue(0) },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    };
    repository = new EventsRepository(prisma as unknown as PrismaService);
  });
  it('filters carousel by publication, opt-in, inclusive start and exclusive end', async () => {
    const now = new Date('2026-10-08T00:00:00Z');
    await repository.carousel(now);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          is_published: true,
          show_on_carousel: true,
          starts_at: { lte: now },
          ends_at: { gt: now },
        },
        orderBy: [{ sort_order: 'asc' }, { starts_at: 'desc' }, { id: 'asc' }],
        take: 20,
      }),
    );
  });
  it('public pages always filter published events and apply pagination', async () => {
    await repository.list({ page: 3, pageSize: 10 }, true);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { is_published: true },
        take: 10,
        skip: 20,
      }),
    );
  });
  it('uses a safe whitelist to map grid sorting to database fields', async () => {
    await repository.list({
      page: 1,
      pageSize: 20,
      orderBy: 'startsAt:desc,title:asc',
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ starts_at: 'desc' }, { title: 'asc' }, { id: 'asc' }],
      }),
    );
    await expect(
      repository.list({ page: 1, pageSize: 20, orderBy: 'description:asc' }),
    ).rejects.toThrow(BadRequestException);
  });
  it('does not expose unpublished details', async () => {
    await expect(repository.find({ slug: 'draft' }, true)).rejects.toThrow(
      NotFoundException,
    );
    expect(findFirst).toHaveBeenCalledWith({
      where: { slug: 'draft', is_published: true },
    });
  });
});
