import ProductGrid from "@/features/main/components/ProductGrid/ProductGrid";
import Hydration from "@/components/ssr/Hydration/Hydration";
import { getQueryClient } from "@/utils/query";
import { dehydrate } from "@tanstack/react-query";
import {
  getUserProducts,
  getGetUserProductsQueryKey,
} from "@e-commerce/api-client/endpoints/product";

export default async function ProductSlot() {
  const queryClient = getQueryClient();
  const params = { page: 1, pageSize: 20 };

  await queryClient.prefetchQuery({
    queryKey: getGetUserProductsQueryKey(params),
    queryFn: () => getUserProducts(params),
  });

  return (
    <Hydration state={dehydrate(queryClient)}>
      <ProductGrid params={params} />
    </Hydration>
  );
}
