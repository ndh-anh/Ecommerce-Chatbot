import type { Metadata } from "next";
import SuspenseWrapper from "@/components/feedback/SuspenseWrapper/SuspenseWrapper";
import Hydration from "@/components/ssr/Hydration/Hydration";
import ProductList from "@/features/main/components/ProductList/ProductList";
import {
  parseSearchParams,
  serializeSearchParams,
} from "@/providers/SearchProvider/utils";
import { getQueryClient } from "@/utils/query";
import {
  getUserProducts,
  getGetUserProductsQueryKey,
  getBrands,
  getGetBrandsQueryKey,
  getCategories,
  getGetCategoriesQueryKey,
} from "@e-commerce/api-client/endpoints/product";
import { getUserProductsQueryParams } from "@e-commerce/api-validation/zod/product";
import { dehydrate } from "@tanstack/react-query";

export const metadata: Metadata = {
  title: "Danh sách sản phẩm | E-Commerce",
  description: "Khám phá sản phẩm theo danh mục, thương hiệu và khoảng giá.",
};

interface ProductPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Load published products and catalog filters from the product API for SSR. */
export default async function ProductPage({ searchParams }: ProductPageProps) {
  const params = parseSearchParams(
    serializeSearchParams(await searchParams),
    getUserProductsQueryParams,
  );
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: getGetUserProductsQueryKey(params),
      queryFn: () => getUserProducts(params),
    }),
    queryClient.prefetchQuery({
      queryKey: getGetBrandsQueryKey(),
      queryFn: () => getBrands(),
    }),
    queryClient.prefetchQuery({
      queryKey: getGetCategoriesQueryKey(),
      queryFn: () => getCategories(),
    }),
  ]);

  return (
    <section className="w-full flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-semibold">Danh sách sản phẩm</h1>
      <Hydration state={dehydrate(queryClient)}>
        <SuspenseWrapper>
          <ProductList />
        </SuspenseWrapper>
      </Hydration>
    </section>
  );
}
