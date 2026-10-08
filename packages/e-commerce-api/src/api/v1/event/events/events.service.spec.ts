import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';

const event = {
  id: 'event-id',
  title: 'Summer sale',
  slug: 'summer-sale',
  thumbnail_url: 'https://images.example.com/banner.jpg',
  description: '<p>Sale</p>',
  summary: 'Sale',
  starts_at: new Date('2026-10-01T00:00:00Z'),
  ends_at: new Date('2026-10-10T00:00:00Z'),
  is_published: true,
  show_on_carousel: true,
  sort_order: 0,
  created_at: new Date('2026-09-01T00:00:00Z'),
  updated_at: new Date('2026-09-01T00:00:00Z'),
};
const body = {
  title: event.title,
  slug: event.slug,
  thumbnailUrl: event.thumbnail_url,
  description: event.description,
  summary: event.summary,
  startsAt: event.starts_at.toISOString(),
  endsAt: event.ends_at.toISOString(),
  isPublished: true,
  showOnCarousel: true,
  sortOrder: 0,
};
describe('EventsService', () => {
  let service: EventsService;
  let repository: jest.Mocked<EventsRepository>;
  beforeEach(() => {
    repository = {
      find: jest.fn().mockResolvedValue(event),
      create: jest.fn().mockResolvedValue(event),
      update: jest.fn().mockResolvedValue(event),
      delete: jest.fn(),
      carousel: jest.fn().mockResolvedValue([event]),
      list: jest
        .fn()
        .mockResolvedValue({ events: [event], totalCount: 1, totalPages: 1 }),
    } as unknown as jest.Mocked<EventsRepository>;
    service = new EventsService(repository);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());
  it('sanitizes rich text, preserving formatting/images while removing executable content', async () => {
    await service.postEvent({
      ...body,
      description:
        '<h2>Sale</h2><p class="ql-align-center" onclick="evil()">Text</p><img src="https://images.example.com/a.jpg" onerror="evil()"><a href="javascript:evil()">Click</a><script>alert(1)</script>',
    });
    const input = repository.create.mock.calls[0][0];
    expect(input.description).toContain('<h2>Sale</h2>');
    expect(input.description).toContain('ql-align-center');
    expect(input.description).toContain(
      'src="https://images.example.com/a.jpg"',
    );
    expect(input.description).not.toMatch(
      /onclick|onerror|javascript:|<script/,
    );
  });
  it.each([
    { endsAt: body.startsAt },
    { startsAt: body.endsAt },
    { startsAt: 'not-a-date' },
  ])('rejects invalid date ranges on create', async (dates) => {
    await expect(service.postEvent({ ...body, ...dates })).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.create).not.toHaveBeenCalled();
  });
  it('validates the complete interval when only the end date changes', async () => {
    await expect(
      service.patchEvent(
        { eventId: event.id },
        { endsAt: '2026-09-01T00:00:00Z' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });
  it('preserves unedited fields on partial updates', async () => {
    await service.patchEvent({ eventId: event.id }, { title: 'Updated' });
    expect(repository.update).toHaveBeenCalledWith(
      event.id,
      expect.objectContaining({
        title: 'Updated',
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        showOnCarousel: true,
      }),
    );
  });
  it('does not publish visually empty Quill content', async () => {
    await expect(
      service.postEvent({ ...body, description: '<p><br></p>' }),
    ).rejects.toThrow(BadRequestException);
  });
  it('allows empty content to be saved as a draft', async () => {
    await service.postEvent({ ...body, isPublished: false, description: '' });
    expect(repository.create).toHaveBeenCalled();
  });
  it.each([-1, 0.5])(
    'rejects non-integer or negative display order %s',
    async (sortOrder) => {
      await expect(service.postEvent({ ...body, sortOrder })).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    },
  );
  it('rejects unsafe image protocols', async () => {
    await expect(
      service.postEvent({ ...body, thumbnailUrl: 'javascript:alert(1)' }),
    ).rejects.toThrow(BadRequestException);
  });
  it('returns a friendly slug conflict error', async () => {
    repository.create.mockRejectedValue({ code: 'P2002' });
    await expect(service.postEvent(body)).rejects.toThrow(
      'Slug sự kiện đã tồn tại',
    );
  });
  it('public detail always requires a published record', async () => {
    await service.getEventBySlug({ slug: event.slug });
    expect(repository.find).toHaveBeenCalledWith({ slug: event.slug }, true);
  });
  it('public listing cannot expose drafts', async () => {
    await service.getPublicEvents({ page: 1, pageSize: 20 });
    expect(repository.list).toHaveBeenCalledWith(
      { page: 1, pageSize: 20 },
      true,
    );
  });
  it('carousel responses omit full rich text and classify active events', async () => {
    const result = await service.getCarouselEvents();
    expect(result.events[0]).toEqual(
      expect.objectContaining({ status: 'active', eventId: event.id }),
    );
    expect(result.events[0]).not.toHaveProperty('description');
    expect(repository.carousel).toHaveBeenCalledWith(
      new Date('2026-10-08T00:00:00Z'),
    );
  });
  it.each([
    ['2026-09-30T00:00:00Z', 'upcoming'],
    ['2026-10-01T00:00:00Z', 'active'],
    ['2026-10-10T00:00:00Z', 'ended'],
  ])(
    'uses inclusive start and exclusive end boundaries at %s',
    async (time, status) => {
      jest.setSystemTime(new Date(time));
      expect((await service.getEventById({ eventId: event.id })).status).toBe(
        status,
      );
    },
  );
  it('draft status takes priority over dates', async () => {
    repository.find.mockResolvedValue({ ...event, is_published: false });
    expect((await service.getEventById({ eventId: event.id })).status).toBe(
      'draft',
    );
  });
  it('returns 404 when deleting a missing event', async () => {
    repository.delete.mockRejectedValue({ code: 'P2025' });
    await expect(service.deleteEvent({ eventId: 'missing' })).rejects.toThrow(
      NotFoundException,
    );
  });
});
