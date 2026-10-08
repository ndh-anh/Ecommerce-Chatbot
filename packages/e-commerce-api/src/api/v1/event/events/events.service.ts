import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';
import { EventsRepository } from './events.repository';
import type { events } from 'generated/prisma/client';
import type {
  DeleteEventParams,
  GetEventsQueryParams,
  GetPublicEventsQueryParams,
  GetEventByIdParams,
  GetEventBySlugParams,
  PatchEventParams,
  PatchEventBody,
  PostEventBody,
  GetEventById200Response,
  GetEvents200Response,
} from '@e-commerce/api-validation/types/event';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  private summary(
    event: events,
    now = new Date(),
  ): GetEvents200Response['events'][number] {
    return {
      eventId: event.id,
      title: event.title,
      slug: event.slug,
      thumbnailUrl: event.thumbnail_url,
      summary: event.summary,
      startsAt: event.starts_at.toISOString(),
      endsAt: event.ends_at.toISOString(),
      isPublished: event.is_published,
      showOnCarousel: event.show_on_carousel,
      sortOrder: event.sort_order,
      status: !event.is_published
        ? 'draft'
        : now < event.starts_at
          ? 'upcoming'
          : now >= event.ends_at
            ? 'ended'
            : 'active',
    };
  }

  private response(event: events, now = new Date()): GetEventById200Response {
    return {
      ...this.summary(event, now),
      description: event.description,
      createdAt: event.created_at.toISOString(),
      updatedAt: event.updated_at.toISOString(),
    };
  }

  private validate(input: PostEventBody): PostEventBody {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.');
    }
    if (
      input.sortOrder !== undefined &&
      (!Number.isInteger(input.sortOrder) || input.sortOrder < 0)
    ) {
      throw new BadRequestException(
        'Thứ tự hiển thị phải là số nguyên không âm.',
      );
    }
    if (!input.title.trim())
      throw new BadRequestException('Vui lòng nhập tiêu đề sự kiện.');
    try {
      const thumbnail = new URL(input.thumbnailUrl);
      if (
        !/^https?:\/\//.test(input.thumbnailUrl) ||
        !['https:', 'http:'].includes(thumbnail.protocol)
      )
        throw new Error('Invalid protocol');
    } catch {
      throw new BadRequestException(
        'Thumbnail phải là URL ảnh HTTP hoặc HTTPS hợp lệ.',
      );
    }
    const description = sanitizeHtml(input.description, {
      allowedTags: [
        'p',
        'br',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'h1',
        'h2',
        'h3',
        'blockquote',
        'ul',
        'ol',
        'li',
        'a',
        'img',
        'span',
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel'],
        img: ['src', 'alt'],
        '*': ['class'],
        li: ['data-list'],
      },
      allowedClasses: {
        '*': [
          'ql-align-center',
          'ql-align-right',
          'ql-align-justify',
          'ql-indent-*',
        ],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      allowProtocolRelative: false,
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
      },
    });
    if (
      input.isPublished &&
      !sanitizeHtml(description, {
        allowedTags: [],
        allowedAttributes: {},
      }).trim() &&
      !description.includes('<img ')
    ) {
      throw new BadRequestException(
        'Vui lòng nhập nội dung trước khi xuất bản sự kiện.',
      );
    }
    return {
      ...input,
      title: input.title.trim(),
      summary: input.summary?.trim(),
      description,
    };
  }

  private databaseError(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === 'P2002')
      throw new BadRequestException('Slug sự kiện đã tồn tại.');
    if (code === 'P2025')
      throw new NotFoundException('Không tìm thấy sự kiện.');
    throw error;
  }

  /** List all event states for administrators. */
  async getEvents(query: GetEventsQueryParams) {
    const page = await this.repository.list(query);
    return { ...page, events: page.events.map((event) => this.summary(event)) };
  }
  /** List only published events for guests; historical event pages remain accessible. */
  async getPublicEvents(query: GetPublicEventsQueryParams) {
    const page = await this.repository.list(query, true);
    return { ...page, events: page.events.map((event) => this.summary(event)) };
  }
  /** Resolve active carousel events with the same instant used for status calculation. */
  async getCarouselEvents() {
    const now = new Date();
    return {
      events: (await this.repository.carousel(now)).map((event) =>
        this.summary(event, now),
      ),
    };
  }
  /** Get administrator details by UUID. */
  async getEventById(params: GetEventByIdParams) {
    return this.response(await this.repository.find({ id: params.eventId }));
  }
  /** Get published event content by slug without exposing drafts. */
  async getEventBySlug(params: GetEventBySlugParams) {
    return this.response(
      await this.repository.find({ slug: params.slug }, true),
    );
  }
  /** Validate dates and sanitize rich text before creating an event. */
  async postEvent(body: PostEventBody) {
    const input = this.validate(body);
    try {
      return this.response(await this.repository.create(input));
    } catch (error) {
      this.databaseError(error);
    }
  }
  /** Validate the merged interval so updating just one date cannot leave an invalid event. */
  async patchEvent(params: PatchEventParams, body: PatchEventBody) {
    const current = this.response(
      await this.repository.find({ id: params.eventId }),
    );
    const input = this.validate({ ...current, ...body });
    try {
      return this.response(await this.repository.update(params.eventId, input));
    } catch (error) {
      this.databaseError(error);
    }
  }
  /** Delete an event and translate missing records into a 404 response. */
  async deleteEvent(params: DeleteEventParams) {
    try {
      await this.repository.delete(params.eventId);
    } catch (error) {
      this.databaseError(error);
    }
  }
}
