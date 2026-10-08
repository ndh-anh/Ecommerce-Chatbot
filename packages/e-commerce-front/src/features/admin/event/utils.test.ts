import { describe, expect, it } from "vitest";
import { toLocalDateTime, toEventPayload } from "./utils";
import { postEventBody } from "@e-commerce/api-validation/zod/event";
const body = {
  title: "Sale",
  slug: "sale-he-2026",
  thumbnailUrl: "https://images.example.com/banner.jpg",
  description: "<p>Sale</p>",
  startsAt: "2026-10-08T00:00:00Z",
  endsAt: "2026-10-09T00:00:00Z",
  showOnCarousel: true,
};
describe("Event input contract", () => {
  it("accepts real slugs and the generated default fields", () => {
    expect(postEventBody.safeParse(body).success).toBe(true);
  });
  it.each(["Sale", "sale/event", "sale event", "sale*"])(
    "rejects invalid slug %s",
    (slug) => {
      expect(postEventBody.safeParse({ ...body, slug }).success).toBe(false);
    },
  );
  it("round-trips a local datetime without shifting the stored instant", () => {
    const local = toLocalDateTime(body.startsAt);
    expect(
      toEventPayload({ startsAt: local, endsAt: toLocalDateTime(body.endsAt) })
        .startsAt,
    ).toBe(body.startsAt.replace(":00Z", ":00.000Z"));
  });
});
