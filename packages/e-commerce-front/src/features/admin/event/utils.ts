import { createSearchContext } from "@/providers/SearchProvider/utils/context";
import type { GetEventsQueryParams } from "@e-commerce/api-validation/types/event";
export const eventSearchContext = createSearchContext<GetEventsQueryParams>();
export const eventStatusLabels = {
  draft: "Bản nháp",
  upcoming: "Sắp diễn ra",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
} as const;
export function toLocalDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function toEventPayload<T extends { startsAt: string; endsAt: string }>(
  input: T,
) {
  return {
    ...input,
    startsAt: new Date(input.startsAt).toISOString(),
    endsAt: new Date(input.endsAt).toISOString(),
  };
}
