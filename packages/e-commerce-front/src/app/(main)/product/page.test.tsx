// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  products: vi.fn(),
  brands: vi.fn(),
  categories: vi.fn(),
  search: vi.fn(),
}));
let queryClient: QueryClient;
vi.mock("@/utils/query", () => ({ getQueryClient: () => queryClient }));
vi.mock("@/features/main/components/ProductList/ProductList", () => ({
  default: () => null,
}));
vi.mock("@/components/feedback/SuspenseWrapper/SuspenseWrapper", () => ({
  default: () => null,
}));
vi.mock("@e-commerce/api-client/endpoints/product", () => ({
  getUserProducts: api.products,
  getGetUserProductsQueryKey: (params: unknown) => ["catalog", params],
  getBrands: api.brands,
  getGetBrandsQueryKey: () => ["brands"],
  getCategories: api.categories,
  getGetCategoriesQueryKey: () => ["categories"],
  searchProducts: api.search,
}));

import ProductPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  api.products.mockResolvedValue({
    products: [],
    totalCount: 0,
    totalPages: 0,
  });
  api.brands.mockResolvedValue({ brands: [] });
  api.categories.mockResolvedValue({ categories: [] });
  api.search.mockRejectedValue(new Error("Search service unavailable"));
});

describe("Product catalog SSR", () => {
  it("loads the catalog independently of the search service and hydrates its query", async () => {
    await ProductPage({ searchParams: Promise.resolve({}) });
    const params = { page: 1, pageSize: 20 };
    expect(api.products).toHaveBeenCalledWith(params);
    expect(api.search).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(["catalog", params])).toEqual({
      products: [],
      totalCount: 0,
      totalPages: 0,
    });
    expect(api.brands).toHaveBeenCalledOnce();
    expect(api.categories).toHaveBeenCalledOnce();
  });

  it("parses catalog pagination and filters while excluding search keywords", async () => {
    await ProductPage({
      searchParams: Promise.resolve({
        page: "2",
        pageSize: "10",
        categoryIds: "category",
        brandIds: "brand",
        minPrice: "0",
        maxPrice: "200",
        sortBy: "price",
        sortOrder: "desc",
        keyword: "search only",
      }),
    });
    expect(api.products).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      categoryIds: "category",
      brandIds: "brand",
      minPrice: 0,
      maxPrice: 200,
      sortBy: "price",
      sortOrder: "desc",
    });
  });

  it("falls back to valid pagination defaults", async () => {
    await ProductPage({
      searchParams: Promise.resolve({ page: "0", pageSize: "bad" }),
    });
    expect(api.products).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });
});
