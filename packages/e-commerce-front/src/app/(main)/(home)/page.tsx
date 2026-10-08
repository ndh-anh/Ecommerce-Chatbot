import SpotlightCarousel from "@/features/main/home/components/SpotlightCarousel/SpotlightCarousel";
import {
  getCarouselEvents,
  getGetCarouselEventsQueryKey,
} from "@e-commerce/api-client/endpoints/event";
import Hydration from "@/components/ssr/Hydration/Hydration";
import SuspenseWrapper from "@/components/feedback/SuspenseWrapper/SuspenseWrapper";
import { getQueryClient } from "@/utils/query";
import { dehydrate } from "@tanstack/react-query";
export default async function HomePage() {
  const client = getQueryClient();
  await client.prefetchQuery({
    queryKey: getGetCarouselEventsQueryKey(),
    queryFn: () => getCarouselEvents(),
  });
  return (
    <Hydration state={dehydrate(client)}>
      <SuspenseWrapper>
        <SpotlightCarousel timeout={5000} />
      </SuspenseWrapper>
    </Hydration>
  );
}
