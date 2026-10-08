import "@typespec/http";
import "../common/scalars/scalars.tsp";
import "../common/models/requests.tsp";
import "../common/models/response.tsp";
using TypeSpec.Http;

@maxLength(200)
scalar EventTitle extends NonEmptyString;
@maxLength(200)
@pattern("^[a-z0-9]+(-[a-z0-9]+){0,}$")
scalar EventSlug extends NonEmptyString;
@maxLength(2048)
@format("uri")
scalar EventImageUrl extends NonEmptyString;
@format("date-time")
scalar EventDateTime extends string;

model EventInput {
  title: EventTitle;
  slug: EventSlug;
  thumbnailUrl: EventImageUrl;
  @maxLength(100000) description: string;
  @maxLength(500) summary?: string;
  startsAt: EventDateTime;
  endsAt: EventDateTime;
  isPublished?: boolean = false;
  showOnCarousel?: boolean = true;
  @minValue(0) sortOrder?: int32 = 0;
}
model EventPatch {
  title?: EventTitle;
  slug?: EventSlug;
  thumbnailUrl?: EventImageUrl;
  @maxLength(100000) description?: string;
  @maxLength(500) summary?: string;
  startsAt?: EventDateTime;
  endsAt?: EventDateTime;
  isPublished?: boolean;
  showOnCarousel?: boolean;
  @minValue(0) sortOrder?: int32;
}
model EventSummary {
  eventId: UUID;
  title: string;
  slug: string;
  thumbnailUrl: string;
  summary: string;
  startsAt: EventDateTime;
  endsAt: EventDateTime;
  isPublished: boolean;
  showOnCarousel: boolean;
  sortOrder: int32;
  status: "draft" | "upcoming" | "active" | "ended";
}
model EventResponse {
  ...EventSummary;
  description: string;
  createdAt: EventDateTime;
  updatedAt: EventDateTime;
}
model EventList { ...PageResponse; events: EventSummary[]; }
model EventList200 { @statusCode statusCode: 200; @body body: EventList; }
model Event200 { @statusCode statusCode: 200; @body body: EventResponse; }
model EventCreated { @statusCode statusCode: 201; @body body: EventResponse; }
model EventDeleted { @statusCode statusCode: 204; }
model CarouselEvents200 { @statusCode statusCode: 200; @body body: { events: EventSummary[]; }; }
model EventQuery extends PageQueryParams {
  @query @maxLength(200) title?: string;
}
