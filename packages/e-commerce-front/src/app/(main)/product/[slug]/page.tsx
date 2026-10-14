import ProductDetail from "@/features/main/product/ProductDetail";
import SuspenseWrapper from "@/components/feedback/SuspenseWrapper/SuspenseWrapper";
import Hydration from "@/components/ssr/Hydration/Hydration";
import { getQueryClient } from "@/utils/query";
import { dehydrate } from "@tanstack/react-query";
import {
  getProductBySlug,
  getGetProductBySlugQueryKey,
} from "@e-commerce/api-client/endpoints/product";
import { Metadata } from "next";

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const queryClient = getQueryClient();

  try {
    const product = await queryClient.fetchQuery({
      queryKey: getGetProductBySlugQueryKey(slug),
      queryFn: () => getProductBySlug(slug),
    });

    return {
      title: product.productName,
      description: product.description,
      openGraph: {
        title: product.productName,
        description: product.description,
        images: product.thumbnailUrl ? [{ url: product.thumbnailUrl }] : [],
        type: "website",
      },
      alternates: {
        canonical: `/product/${slug}`,
      },
    };
  } catch (error) {
    console.error("Failed to fetch product for metadata:", error);
    return {
      title: "Không tìm thấy sản phẩm",
      description: "Sản phẩm không tồn tại hoặc đã bị xóa.",
    };
  }
}

const ProductDetailPage = async ({ params }: PageProps<"/product/[slug]">) => {
  const { slug } = await params;
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: getGetProductBySlugQueryKey(slug),
      queryFn: () => getProductBySlug(slug),
    });
  } catch (error) {
    console.error("Failed to prefetch product data:", error);
  }

  return (
    <Hydration state={dehydrate(queryClient)}>
      <SuspenseWrapper>
        <ProductDetail slug={slug} />
      </SuspenseWrapper>
    </Hydration>
  );
};

export default ProductDetailPage;
