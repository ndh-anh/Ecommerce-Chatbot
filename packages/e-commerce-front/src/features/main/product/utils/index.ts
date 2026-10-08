import { createSearchContext } from "@/providers/SearchProvider/utils/context";
import type {
  GetUserProductsQueryParams,
  SearchProductsQueryParams,
} from "@e-commerce/api-validation/types/product";

export const userProductSearchContext =
  createSearchContext<SearchProductsQueryParams>();

/** Catalog filters use the public product list contract, independently of search. */
export const userProductCatalogContext =
  createSearchContext<GetUserProductsQueryParams>();
