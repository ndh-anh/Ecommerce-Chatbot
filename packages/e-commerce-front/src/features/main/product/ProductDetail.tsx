"use client";

import React, { useState } from "react";
import {
  useGetProductBySlugSuspense,
} from "@e-commerce/api-client/endpoints/product";
import {
  usePostCart,
  usePostCartItem,
  getGetCartQueryKey,
  getGetCartItemsQueryKey,
} from "@e-commerce/api-client/endpoints/cart";
import {
  getWishlists,
  usePostWishlist,
  usePostWishlistItem,
  useDeleteWishlistItem,
  getGetWishlistsQueryKey,
  getGetWishlistItemsQueryKey,
} from "@e-commerce/api-client/endpoints/customer";
import { useQueryClient } from "@tanstack/react-query";
import { cartQueryOptions } from "@/hooks/useCart";
import { useUser } from "@/providers/UserProvider/UserProvider";
import Box from "@mui/material/Box";

import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Link from "next/link";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import ShieldIcon from "@mui/icons-material/Shield";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import KeyboardBackspaceIcon from "@mui/icons-material/KeyboardBackspace";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { useSnackbar } from "notistack";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";

// Import extracted components
import { BrandChip } from "./BrandChip";
import { FavoriteButton } from "./FavoriteButton";
import { ProductGallery } from "./ProductGallery";
import { ProductReviews } from "./ProductReviews";

const formatPrice = (value: number | string) => {
  const n = typeof value === "string" ? Number.parseFloat(value) : value;
  if (!Number.isFinite(n) || n <= 0) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
};

const ProductDetail = ({ slug }: { slug: string }) => {
  const { enqueueSnackbar } = useSnackbar();
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0);

  // Instantiate mutation hooks and queryClient
  const queryClient = useQueryClient();
  const postCartMutation = usePostCart();
  const postCartItemMutation = usePostCartItem();
  const postWishlistMutation = usePostWishlist();
  const postWishlistItemMutation = usePostWishlistItem();
  const deleteWishlistItemMutation = useDeleteWishlistItem();

  // 1. Fetch Product details by slug
  const { data: product } = useGetProductBySlugSuspense(slug);

  // 2. Extract Category and Variants from Product
  const category = product.category;
  const variants = product.variants || [];

  const { userId } = useUser();

  // Extract selected variant details
  const activeVariant = variants[selectedVariantIdx] || null;
  const currentPrice = activeVariant ? activeVariant.price : 0;
  const currentComparePrice = activeVariant ? activeVariant.comparePrice : 0;
  const currentStock = activeVariant ? activeVariant.stock : 0;
  const currentSku = activeVariant ? activeVariant.sku : "";

  // Combine product image and variant images into a unified gallery list
  const baseImages = product.images && product.images.length > 0
    ? product.images.map((img: { url: string }) => img.url)
    : [product.thumbnailUrl || ""];

  const variantImages = variants
    .map((v) => v.thumbnailUrl)
    .filter((url): url is string => Boolean(url));

  const allImages = Array.from(new Set([...baseImages, ...variantImages])).filter(Boolean);



  const handleAddToCart = async () => {
    if (!userId) {
      enqueueSnackbar("Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!", {
        variant: "warning",
      });
      return;
    }

    if (!activeVariant) {
      enqueueSnackbar("Vui lòng chọn mẫu sản phẩm!", { variant: "warning" });
      return;
    }

    try {
      const cart = await queryClient.fetchQuery(cartQueryOptions(userId));
      let cartId = cart?.cartId;
      if (!cartId) {
        const newCart = await postCartMutation.mutateAsync({ data: { userId } });
        cartId = newCart.cartId;
        await queryClient.invalidateQueries({
          queryKey: getGetCartQueryKey({ userId }),
        });
      }

      await postCartItemMutation.mutateAsync({
        cartId,
        data: {
          productVariantId: activeVariant.productVariantId,
          quantity: 1,
        },
      });

      await queryClient.invalidateQueries({
        queryKey: getGetCartItemsQueryKey(cartId),
      });

      enqueueSnackbar("Sản phẩm đã được thêm vào giỏ hàng thành công!", {
        variant: "success",
        anchorOrigin: { vertical: "top", horizontal: "right" },
      });
    } catch (error) {
      console.error("Cart error:", error);
      enqueueSnackbar("Không thể thêm vào giỏ hàng. Vui lòng thử lại!", {
        variant: "error",
      });
    }
  };

  const handleAddToWishlist = async (isFav: boolean, wishlistItems: any[]) => {
    if (!userId) {
      enqueueSnackbar("Vui lòng đăng nhập để lưu sản phẩm yêu thích!", {
        variant: "warning",
      });
      return;
    }

    try {
      const res = await queryClient.fetchQuery({
        queryKey: getGetWishlistsQueryKey({ userId }),
        queryFn: () => getWishlists({ userId }),
      });
      const wishlists = res.wishlists || [];
      let currentWishlistId: string;

      if (wishlists.length > 0) {
        currentWishlistId = wishlists[0].wishlistId;
      } else {
        const newWl = await postWishlistMutation.mutateAsync({ data: { userId } });
        currentWishlistId = newWl.wishlistId;
        queryClient.setQueryData(getGetWishlistsQueryKey({ userId }), { wishlists: [newWl] });
      }

      if (isFav) {
        const item = wishlistItems?.find((i) => i.productId === product.productId);
        if (item) {
          await deleteWishlistItemMutation.mutateAsync({
            wishlistId: currentWishlistId,
            wishlistItemId: item.wishlistItemId,
          });
          enqueueSnackbar("Đã xóa sản phẩm khỏi danh sách yêu thích!", {
            variant: "success",
            anchorOrigin: { vertical: "top", horizontal: "right" },
          });
        }
      } else {
        await postWishlistItemMutation.mutateAsync({
          wishlistId: currentWishlistId,
          data: { productId: product.productId },
        });
        enqueueSnackbar("Đã thêm sản phẩm vào danh sách yêu thích thành công!", {
          variant: "success",
          anchorOrigin: { vertical: "top", horizontal: "right" },
        });
      }

      // Invalidate queries to trigger suspense updates
      await queryClient.invalidateQueries({
        queryKey: getGetWishlistItemsQueryKey(currentWishlistId),
      });
    } catch (error) {
      console.error("Wishlist error:", error);
      enqueueSnackbar("Có lỗi xảy ra. Vui lòng thử lại!", {
        variant: "error",
      });
    }
  };

  return (
    <Box sx={{ py: { xs: 4, md: 8 }, width: '100%' }}>
      {/* Breadcrumbs / Back Link */}
      <Stack direction="row" alignItems="center" spacing={1} mb={3}>
        <Link
          href="/product"
          style={{
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            alignItems: "center",
          }}
        >
          <KeyboardBackspaceIcon fontSize="small" sx={{ mr: 0.5 }} />
          <Typography
            variant="regularS"
            color="text.secondary"
            sx={{ "&:hover": { color: "primary.main" } }}
          >
            Quay lại cửa hàng
          </Typography>
        </Link>
      </Stack>

      <Grid container spacing={5}>
        {/* Left Column: Image Gallery (Carousel) */}
        <Grid size={{ xs: 12, md: 6 }}>
          <ProductGallery
            allImages={allImages}
            productName={product.productName}
            activeImageIdx={activeImageIdx}
            setActiveImageIdx={setActiveImageIdx}
          />
        </Grid>

        {/* Right Column: Main Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={3}>
            {/* Badges & Titles */}
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                <Chip
                  label={category?.categoryName || "Danh mục"}
                  color="primary"
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: "flex-start", fontWeight: 700, px: 1 }}
                />
                {product.brandId && (
                  <React.Suspense fallback={null}>
                    <BrandChip brandId={product.brandId} />
                  </React.Suspense>
                )}
              </Stack>

              <Typography
                variant="title"
                className="text-[28px] md:text-[36px] font-extrabold text-gray-900 leading-[1.2] tracking-[-0.5px]"
              >
                {product.productName}
              </Typography>

              {currentSku && (
                <Typography variant="regularXs" color="text.secondary">
                  SKU: <strong style={{ color: "#151426" }}>{currentSku}</strong>
                </Typography>
              )}
            </Stack>

            <Divider />

            {/* Price section */}
            <Stack spacing={0.5}>
              <Stack direction="row" alignItems="baseline" spacing={2}>
                <Typography
                  variant="boldL"
                  className="text-[36px] font-extrabold bg-linear-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent drop-shadow-sm"
                >
                  {formatPrice(currentPrice)}
                </Typography>

                {currentComparePrice > currentPrice && (
                  <Typography
                    variant="regularM"
                    className="line-through text-gray-400 font-medium"
                  >
                    {formatPrice(currentComparePrice)}
                  </Typography>
                )}
              </Stack>

              <Typography variant="regularXs" color="text.secondary">
                {currentStock > 0 ? (
                  <span>
                    Trạng thái: <strong style={{ color: "#22C55E" }}>Còn {currentStock} sản phẩm</strong>
                  </span>
                ) : (
                  <span>
                    Trạng thái: <strong style={{ color: "#EF4444" }}>Hết hàng tạm thời</strong>
                  </span>
                )}
              </Typography>
            </Stack>

            {/* Variant Selector */}
            {variants.length > 1 && (
              <Stack spacing={1.5}>
                <Typography variant="boldS" sx={{ color: "text.primary" }}>
                  Mẫu sản phẩm:
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1.5}>
                  {variants.map((v, idx) => {
                    const isSelected = selectedVariantIdx === idx;
                    const attrLabel = v.variantAttributes
                      ? v.variantAttributes
                          .map((a) => `${a.attributeName}: ${a.attributeValue}`)
                          .join(", ")
                      : `Mẫu #${idx + 1}`;

                    return (
                      <Box
                        key={v.productVariantId}
                        onClick={() => {
                          setSelectedVariantIdx(idx);
                          if (v.thumbnailUrl) {
                            const imgIndex = allImages.indexOf(v.thumbnailUrl);
                            if (imgIndex !== -1) {
                              setActiveImageIdx(imgIndex);
                            }
                          }
                        }}
                        className={`px-5 py-[10px] rounded-xl border-[1.5px] cursor-pointer transition-all duration-300 hover:border-indigo-400 hover:-translate-y-0.5 hover:shadow-sm ${
                          isSelected
                            ? "border-indigo-600 bg-indigo-50/50 shadow-md -translate-y-0.5"
                            : "border-gray-200 bg-white translate-y-0"
                        }`}
                      >
                        <Typography
                          variant="boldS"
                          color={isSelected ? "primary.main" : "text.primary"}
                        >
                          {attrLabel}
                        </Typography>
                        <Typography variant="regularXs" color="text.secondary" mt={0.5}>
                          {v.stock > 0 ? `Tồn: ${v.stock}` : "Hết hàng"} — {formatPrice(v.price)}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Stack>
            )}

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} pt={1}>
              <Button
                variant="contained"
                disabled={currentStock <= 0}
                startIcon={<ShoppingCartIcon />}
                onClick={handleAddToCart}
                className={`flex-2 py-3 px-6 text-[15px] font-bold rounded-xl border-none transition-all duration-300 ${
                  currentStock <= 0
                    ? "bg-gray-200 text-gray-400 shadow-none transform-none"
                    : "bg-linear-to-br from-indigo-600 to-indigo-500 text-white shadow-[0_8px_16px_-4px_rgba(79,70,229,0.4)] -translate-y-px hover:from-indigo-700 hover:to-indigo-600 hover:shadow-[0_12px_20px_-4px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 active:scale-95"
                }`}
              >
                Thêm vào giỏ hàng
              </Button>
              <FavoriteButton
                productId={product.productId}
                userId={userId}
                handleAddToWishlist={handleAddToWishlist}
              />
            </Stack>

            <Divider />

            {/* Assurances list */}
            <Box className="p-5 bg-slate-50 rounded-2xl border border-gray-200">
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <ShieldIcon sx={{ color: "primary.main", mt: 0.5 }} />
                  <Typography variant="regularS" color="text.primary" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ fontWeight: 700 }}>Bảo hành chính hãng 12 tháng:</strong> Yên tâm tuyệt đối khi mua sắm.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <LocalShippingIcon sx={{ color: "primary.main", mt: 0.5 }} />
                  <Typography variant="regularS" color="text.primary" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ fontWeight: 700 }}>Giao hàng miễn phí:</strong> Áp dụng cho mọi đơn hàng từ 500.000đ.
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <AutorenewIcon sx={{ color: "primary.main", mt: 0.5 }} />
                  <Typography variant="regularS" color="text.primary" sx={{ lineHeight: 1.6 }}>
                    <strong style={{ fontWeight: 700 }}>Đổi trả miễn phí trong 30 ngày:</strong> Hỗ trợ tận tâm, đổi trả dễ dàng.
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Grid>

        {/* Bottom Part: Description */}
        <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Paper
            sx={{
              p: { xs: 3, md: 5 },
              borderRadius: 5,
              border: "1px solid",
              borderColor: "divider",
              boxShadow: "0 12px 32px -8px rgba(0,0,0,0.03)",
            }}
          >
            <Typography variant="header" mb={3} sx={{ fontWeight: 700, display: "block" }}>
              Mô tả chi tiết sản phẩm
            </Typography>
            <Divider sx={{ mb: 3 }} />
            {product.description ? (
              <Box
                dangerouslySetInnerHTML={{ __html: product.description }}
                sx={{
                  fontSize: "16px",
                  lineHeight: "1.8",
                  color: "text.secondary",
                  "& p": { mb: 2.5 },
                  "& ul, & ol": { pl: 3, mb: 2.5 },
                  "& img": {
                    maxWidth: "100%",
                    height: "auto",
                    borderRadius: 3,
                    my: 2,
                  },
                }}
              />
            ) : (
              <Typography variant="regularM" color="text.secondary">
                Không có mô tả chi tiết cho sản phẩm này.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Comments & Review Section */}
        <Grid size={{ xs: 12 }} sx={{ mt: 2 }}>
          <ProductReviews  />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductDetail;
