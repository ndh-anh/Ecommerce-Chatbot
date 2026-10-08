import { Injectable } from '@nestjs/common';
import { EventsService } from './events.service';
import type {
  DeleteEventParams,
  GetCarouselEvents200Response,
  GetEventByIdParams,
  GetEventById200Response,
  GetEventBySlugParams,
  GetEventBySlug200Response,
  GetEventsQueryParams,
  GetEvents200Response,
  GetPublicEventsQueryParams,
  GetPublicEvents200Response,
  PatchEventParams,
  PatchEventBody,
  PatchEvent200Response,
  PostEventBody,
  PostEvent201Response,
} from '@e-commerce/api-validation/types/event';
import type { BaseEventsControllerInterface } from '@generated-controller/event/events/base-events.controller.interface';

@Injectable()
export class EventsController implements BaseEventsControllerInterface {
  constructor(private readonly service: EventsService) {}

  /**
   * DELETE /api/v1/events/:eventId
   */
  async deleteEvent(params: DeleteEventParams): Promise<void> {
    await this.service.deleteEvent(params);
  }

  /**
   * GET /api/v1/public/events/carousel
   */
  async getCarouselEvents(): Promise<GetCarouselEvents200Response> {
    return await this.service.getCarouselEvents();
  }

  /**
   * GET /api/v1/events/:eventId
   */
  async getEventById(
    params: GetEventByIdParams,
  ): Promise<GetEventById200Response> {
    return await this.service.getEventById(params);
  }

  /**
   * GET /api/v1/public/events/:slug
   */
  async getEventBySlug(
    params: GetEventBySlugParams,
  ): Promise<GetEventBySlug200Response> {
    return await this.service.getEventBySlug(params);
  }

  /**
   * GET /api/v1/events
   */
  async getEvents(query: GetEventsQueryParams): Promise<GetEvents200Response> {
    return await this.service.getEvents(query);
  }

  /**
   * GET /api/v1/public/events
   */
  async getPublicEvents(
    query: GetPublicEventsQueryParams,
  ): Promise<GetPublicEvents200Response> {
    return await this.service.getPublicEvents(query);
  }

  /**
   * PATCH /api/v1/events/:eventId
   */
  async patchEvent(
    params: PatchEventParams,

    body: PatchEventBody,
  ): Promise<PatchEvent200Response> {
    return await this.service.patchEvent(
      params,

      body,
    );
  }

  /**
   * POST /api/v1/events
   */
  async postEvent(body: PostEventBody): Promise<PostEvent201Response> {
    return await this.service.postEvent(body);
  }
}
