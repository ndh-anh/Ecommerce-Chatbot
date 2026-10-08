import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SpotlightCarousel from "./SpotlightCarousel";
const mocks = vi.hoisted(() => ({ data: { events: [] as any[] } }));
vi.mock("@e-commerce/api-client/endpoints/event", () => ({
  useGetCarouselEventsSuspense: () => ({ data: mocks.data }),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));
const base = {
  eventId: "first",
  title: "Summer sale",
  slug: "summer-sale",
  thumbnailUrl: "https://images.example.com/banner.jpg",
  summary: "Save more",
  isPublished: true,
  showOnCarousel: true,
  startsAt: "2026-10-01T00:00:00Z",
  endsAt: "2026-10-10T00:00:00Z",
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
  mocks.data = { events: [] };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
describe("Event carousel", () => {
  it("renders no hardcoded slides when no events are active", () => {
    render(<SpotlightCarousel />);
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByText("Minimalist Essentials")).toBeNull();
  });
  it("shows the event image and links to the event slug", () => {
    mocks.data = { events: [base] };
    render(<SpotlightCarousel />);
    expect(screen.getByRole("img").getAttribute("src")).toBe(base.thumbnailUrl);
    expect(
      screen.getByRole("link", { name: "Xem sự kiện" }).getAttribute("href"),
    ).toBe("/event/summer-sale");
    expect(
      screen.queryByRole("button", { name: "Sự kiện tiếp theo" }),
    ).toBeNull();
  });
  it("skips drafts, future, expired and carousel-disabled events", () => {
    mocks.data = {
      events: [
        { ...base, isPublished: false },
        { ...base, startsAt: "2026-10-09T00:00:00Z" },
        { ...base, endsAt: "2026-10-08T00:00:00Z" },
        { ...base, showOnCarousel: false },
      ],
    };
    render(<SpotlightCarousel />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("removes an event at its end time without waiting for a network poll", () => {
    mocks.data = { events: [{ ...base, endsAt: "2026-10-08T00:00:01Z" }] };
    render(<SpotlightCarousel />);
    act(() => vi.advanceTimersByTime(1002));
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("supports manual navigation and pauses autoplay on hover", () => {
    mocks.data = {
      events: [
        base,
        {
          ...base,
          eventId: "second",
          title: "Second event",
          slug: "second-event",
        },
      ],
    };
    render(<SpotlightCarousel timeout={5000} />);
    fireEvent.mouseEnter(screen.getByRole("region"));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByRole("heading").textContent).toBe("Summer sale");
    fireEvent.click(screen.getByRole("button", { name: "Sự kiện tiếp theo" }));
    expect(screen.getByRole("heading").textContent).toBe("Second event");
  });
  it("handles refreshed data with fewer slides without reading an invalid index", () => {
    mocks.data = {
      events: [base, { ...base, eventId: "second", title: "Second event" }],
    };
    const { rerender } = render(<SpotlightCarousel timeout={0} />);
    fireEvent.click(screen.getByRole("button", { name: "Sự kiện tiếp theo" }));
    mocks.data = { events: [base] };
    rerender(<SpotlightCarousel timeout={0} />);
    expect(screen.getByRole("heading").textContent).toBe("Summer sale");
  });
});
