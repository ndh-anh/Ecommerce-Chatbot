import "@typespec/http";
import "@typespec/openapi";
import "./models.tsp";
import "../common/models/errors.tsp";
using TypeSpec.Http;
using TypeSpec.OpenAPI;
namespace Event.Events {
  @get @route("/events") @tag("events") @operationId("getEvents")
  op list(...EventQuery): EventList200 | UnauthorizedError | ForbiddenError | BadRequestError | InternalServerError;
  @get @route("/events/{eventId}") @tag("events") @operationId("getEventById")
  op detail(@path eventId: UUID): Event200 | NotFoundError | UnauthorizedError | ForbiddenError | BadRequestError | InternalServerError;
  @post @route("/events") @tag("events") @operationId("postEvent")
  op create(@body body: EventInput): EventCreated | UnauthorizedError | ForbiddenError | BadRequestError | InternalServerError;
  @patch @route("/events/{eventId}") @tag("events") @operationId("patchEvent")
  op update(@path eventId: UUID, @body body: EventPatch): Event200 | NotFoundError | UnauthorizedError | ForbiddenError | BadRequestError | InternalServerError;
  @delete @route("/events/{eventId}") @tag("events") @operationId("deleteEvent")
  op remove(@path eventId: UUID): EventDeleted | NotFoundError | UnauthorizedError | ForbiddenError | BadRequestError | InternalServerError;
  @get @route("/public/events") @tag("events") @operationId("getPublicEvents") @extension("x-public", true)
  op publicList(...PageQueryParams): EventList200 | BadRequestError | InternalServerError;
  @get @route("/public/events/carousel") @tag("events") @operationId("getCarouselEvents") @extension("x-public", true)
  op carousel(): CarouselEvents200 | InternalServerError;
  @get @route("/public/events/{slug}") @tag("events") @operationId("getEventBySlug") @extension("x-public", true)
  op publicDetail(@path slug: EventSlug): Event200 | NotFoundError | BadRequestError | InternalServerError;
}
