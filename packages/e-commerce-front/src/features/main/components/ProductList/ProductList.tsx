"use client";

import { useState, useMemo } from "react";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";

import ProductCard from "@/features/main/components/ProductCard/ProductCard";
import {
  useGetUserProductsSuspense,
  useGetBrandsSuspense,
  useGetCategoriesSuspense,
} from "@e-commerce/api-client/endpoints/product";
import { userProductCatalogContext } from "@/features/main/product/utils";
import SearchProvider from "@/providers/SearchProvider/SearchProvider";
import { getUserProductsQueryParams } from "@e-commerce/api-validation/zod/product";
import FilterBar from "./FilterBar";
import FilterDialog from "./FilterDialog";

const ProductListContent = () => {
  const { params, setParams } = userProductCatalogContext.useSearch();
  const { data } = useGetUserProductsSuspense(params);

  // Accumulate products for "Load More" functionality
  const [accumulatedProducts, setAccumulatedProducts] = useState(data.products);
  const [prevDataProducts, setPrevDataProducts] = useState(data.products);

  if (data.products !== prevDataProducts) {
    setPrevDataProducts(data.products);
    if (!params.page || params.page === 1) {
      setAccumulatedProducts(data.products);
    } else {
      setAccumulatedProducts((prev) => {
        const newProducts = data.products.filter(
          (p) => !prev.some((existing) => existing.productId === p.productId),
        );
        return [...prev, ...newProducts];
      });
    }
  }

  // Load danh sách thương hiệu & danh mục phục vụ bộ lọc
  const { data: brandsData } = useGetBrandsSuspense();
  const { data: categoriesData } = useGetCategoriesSuspense();

  // State Dialog bộ lọc
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  // Local logic for selected brands
  const selectedBrands = useMemo(() => {
    const brandIdsArray = params.brandIds
      ? params.brandIds.split(",").filter(Boolean)
      : [];
    if (!brandsData?.brands || brandIdsArray.length === 0) return [];
    return brandsData.brands.filter((b) => brandIdsArray.includes(b.brandId));
  }, [brandsData, params.brandIds]);

  // Local logic for selected categories
  const categoryIdsParam = params.categoryIds;
  const selectedCategories = useMemo(() => {
    const categoryIdsArray = categoryIdsParam
      ? categoryIdsParam.split(",").filter(Boolean)
      : [];
    if (!categoriesData?.categories || categoryIdsArray.length === 0) return [];
    return categoriesData.categories.filter((c) =>
      categoryIdsArray.includes(c.categoryId),
    );
  }, [categoriesData, categoryIdsParam]);

  const handleRemoveCategory = (categoryIdToRemove: string) => {
    const categoryIdsArray = params.categoryIds
      ? params.categoryIds.split(",").filter(Boolean)
      : [];
    const newCategoryIds = categoryIdsArray.filter(
      (id: string) => id !== categoryIdToRemove,
    );
    setParams({
      page: 1,
      categoryIds:
        newCategoryIds.length > 0 ? newCategoryIds.join(",") : undefined,
    });
  };

  const handleRemoveBrand = (brandIdToRemove: string) => {
    const brandIdsArray = params.brandIds
      ? params.brandIds.split(",").filter(Boolean)
      : [];
    const newBrandIds = brandIdsArray.filter(
      (id: string) => id !== brandIdToRemove,
    );
    setParams({
      page: 1,
      brandIds: newBrandIds.length > 0 ? newBrandIds.join(",") : undefined,
    });
  };

  const handleApplyPrice = (
    min: number | undefined,
    max: number | undefined,
  ) => {
    setParams({
      page: 1,
      minPrice: min,
      maxPrice: max,
    });
  };

  const handleApplyFilters = (
    selectedBrandIds: string[],
    selectedCategoryIds: string[],
  ) => {
    setParams({
      page: 1,
      brandIds:
        selectedBrandIds.length > 0 ? selectedBrandIds.join(",") : undefined,
      categoryIds:
        selectedCategoryIds.length > 0
          ? selectedCategoryIds.join(",")
          : undefined,
    });
    setFilterDialogOpen(false);
  };

  const handleResetFilters = () => {
    setParams({
      page: 1,
      productName: undefined,
      brandIds: undefined,
      categoryIds: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });
  };

  const handleSortChange = (
    sortBy: string | undefined,
    sortOrder: string | undefined,
  ) => {
    setParams({
      page: 1,
      sortBy,
      sortOrder,
    });
  };

  const hasActiveFilters = !!(
    params.brandIds ||
    params.categoryIds ||
    params.minPrice !== undefined ||
    params.maxPrice !== undefined ||
    params.productName
  );

  return (
    <Stack spacing={3} width="100%">
      {/* Thanh Filter nằm ngang ở dưới */}
      <FilterBar
        brandIds={params.brandIds}
        categoryIds={params.categoryIds}
        minPrice={params.minPrice}
        maxPrice={params.maxPrice}
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        hasActiveFilters={hasActiveFilters}
        onOpenFilterDialog={() => setFilterDialogOpen(true)}
        onApplyPrice={handleApplyPrice}
        onSortChange={handleSortChange}
        onResetFilters={handleResetFilters}
      />

      {/* Hiển thị danh mục & thương hiệu đã chọn */}
      {(selectedBrands.length > 0 || selectedCategories.length > 0) && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            alignItems: "center",
          }}
        >
          <Typography
            variant="regularS"
            color="text.secondary"
            sx={{ mr: 0.5 }}
          >
            Bộ lọc:
          </Typography>

          {selectedCategories.map((category) => (
            <Chip
              key={category.categoryId}
              label={category.categoryName}
              onDelete={() => handleRemoveCategory(category.categoryId)}
              color="secondary"
              variant="outlined"
              size="small"
              sx={{
                borderRadius: 1.5,
                fontWeight: 600,
                bgcolor: "rgba(0,0,0,0.02)",
              }}
            />
          ))}

          {selectedBrands.map((brand) => (
            <Chip
              key={brand.brandId}
              label={brand.brandName}
              onDelete={() => handleRemoveBrand(brand.brandId)}
              color="primary"
              variant="outlined"
              size="small"
              sx={{
                borderRadius: 1.5,
                fontWeight: 600,
                bgcolor: "rgba(0,0,0,0.02)",
              }}
            />
          ))}

          <Typography
            variant="regularS"
            color="error.main"
            sx={{
              cursor: "pointer",
              ml: 1,
              "&:hover": { textDecoration: "underline" },
            }}
            onClick={handleResetFilters}
          >
            Xóa tất cả
          </Typography>
        </Box>
      )}

      {/* Kết quả đếm số lượng */}
      <Typography variant="regularS" color="text.secondary">
        {data.totalCount > 0
          ? `Hiển thị 1 - ${accumulatedProducts.length} / ${data.totalCount} sản phẩm`
          : "Không có sản phẩm nào"}
      </Typography>

      {/* Grid danh sách sản phẩm chiếm trọn 12 cột */}
      {accumulatedProducts.length > 0 ? (
        <Grid container spacing={2}>
          {accumulatedProducts.map((product) => (
            <Grid
              key={product.productId}
              size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
            >
              <ProductCard product={product} />
            </Grid>
          ))}
        </Grid>
      ) : (
        <Stack
          alignItems="center"
          justifyContent="center"
          py={10}
          spacing={1.5}
          sx={{
            bgcolor: "background.paper",
            borderRadius: 4,
            border: "1px dashed",
            borderColor: "divider",
          }}
        >
          <Typography variant="boldM" color="text.secondary">
            Không tìm thấy sản phẩm nào
          </Typography>
          <Typography variant="regularS" color="text.secondary">
            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.
          </Typography>
        </Stack>
      )}

      {/* Nút Xem thêm */}
      {(params.page || 1) < data.totalPages && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setParams({ page: (params.page || 1) + 1 })}
            sx={{
              borderRadius: 8,
              px: 4,
              py: 1,
              fontWeight: 600,
              textTransform: "none",
            }}
          >
            Xem thêm
          </Button>
        </Box>
      )}

      {/* Dialog chọn bộ lọc */}
      {filterDialogOpen && (
        <FilterDialog
          open={filterDialogOpen}
          onClose={() => setFilterDialogOpen(false)}
          brandIds={params.brandIds}
          categoryIds={params.categoryIds}
          onApply={handleApplyFilters}
          brandsData={brandsData}
          categoriesData={categoriesData}
        />
      )}
    </Stack>
  );
};

const ProductList = () => {
  return (
    <SearchProvider
      context={userProductCatalogContext}
      schema={getUserProductsQueryParams}
    >
      <ProductListContent />
    </SearchProvider>
  );
};

export default ProductList;
