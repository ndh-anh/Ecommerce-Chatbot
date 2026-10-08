import EventList from "@/features/main/event/EventList";
import Hydration from "@/components/ssr/Hydration/Hydration";
import SuspenseWrapper from "@/components/feedback/SuspenseWrapper/SuspenseWrapper";
import {
  getPublicEvents,
  getGetPublicEventsQueryKey,
} from "@e-commerce/api-client/endpoints/event";
import { getPublicEventsQueryParams } from "@e-commerce/api-validation/zod/event";
import {
  parseSearchParams,
  serializeSearchParams,
} from "@/providers/SearchProvider/utils";
import { getQueryClient } from "@/utils/query";
import { dehydrate } from "@tanstack/react-query";
export const dynamic = "force-dynamic";
export const metadata = { title: "Sự kiện" };
export default async function Page({ searchParams }: PageProps<"/event">) {
  const params = parseSearchParams(
    serializeSearchParams(await searchParams),
    getPublicEventsQueryParams,
  );
  const client = getQueryClient();
  await client.prefetchQuery({
    queryKey: getGetPublicEventsQueryKey(params),
    queryFn: () => getPublicEvents(params),
  });
  return (
    <Hydration state={dehydrate(client)}>
      <SuspenseWrapper>
        <EventList params={params} />
      </SuspenseWrapper>
    </Hydration>
  );
}
