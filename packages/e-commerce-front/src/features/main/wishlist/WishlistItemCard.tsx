"use client";

import React from "react";
import {
  useGetProductByProductIdSuspense,
  useGetProductVariantsSuspense,
} from "@e-commerce/api-client/endpoints/product";
import {
  getCart,
  usePostCart,
  usePostCartItem,
  getGetCartQueryKey,
} from "@e-commerce/api-client/endpoints/cart";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/providers/UserProvider/UserProvider";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import Link from "next/link";
import Image from "next/image";
import { useSnackbar } from "notistack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";

const STATUS_NOT_FOUND = 404;

const formatPrice = (value: number) => {
  if (value <= 0) return "Liên hệ";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
};



interface WishlistItemCardProps {
  item: any;
  wishlistId: string;
  onDelete: (wishlistItemId: string) => void;
}

export const WishlistItemCard = ({
  item,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  wishlistId,
  onDelete,
}: WishlistItemCardProps) => {
  const { userId } = useUser();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const postCartMutation = usePostCart();
  const postCartItemMutation = usePostCartItem();

  // Fetch product and variants details
  const { data: product } = useGetProductByProductIdSuspense(item.productId);
  const { data: variantsData } = useGetProductVariantsSuspense({ productId: item.productId });
  const variants = variantsData?.productVariants || [];
  const defaultVariant = variants[0] || null;

  const price = defaultVariant ? defaultVariant.price : 0;
  const imageUrl = defaultVariant?.thumbnailUrl || product.thumbnailUrl || "";

  const handleAddToCart = async () => {
    if (!userId) {
      enqueueSnackbar("Vui lòng đăng nhập để thực hiện chức năng này!", { variant: "warning" });
      return;
    }

    if (!defaultVariant) {
      enqueueSnackbar("Sản phẩm không có biến thể sẵn có!", { variant: "warning" });
      return;
    }

    try {
      let cartId: string;
      try {
        const cart = await queryClient.fetchQuery({
          queryKey: getGetCartQueryKey({ userId }),
          queryFn: () => getCart({ userId }),
        });
        cartId = cart.cartId;
      } catch (error: any) {
        const status = error?.response?.status || error?.status;
        if (status === STATUS_NOT_FOUND || String(error).includes("404")) {
          const newCart = await postCartMutation.mutateAsync({ data: { userId } });
          cartId = newCart.cartId;
          queryClient.setQueryData(getGetCartQueryKey({ userId }), newCart);
        } else {
          throw error;
        }
      }

      await postCartItemMutation.mutateAsync({
        cartId,
        data: {
          productVariantId: defaultVariant.productVariantId,
          quantity: 1,
        },
      });

      enqueueSnackbar("Sản phẩm đã được thêm vào giỏ hàng thành công!", {
        variant: "success",
        anchorOrigin: { vertical: "top", horizontal: "right" },
      });
    } catch (error) {
      console.error("Cart error:", error);
      enqueueSnackbar("Không thể thêm vào giỏ hàng. Vui lòng thử lại!", { variant: "error" });
    }
  };

  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "none",
        borderRadius: 4,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Product Image */}
      <Box sx={{ aspectRatio: "4/3", position: "relative", bgcolor: "#f8fafc" }}>
        {imageUrl ? (
          <Image src={imageUrl} alt={product.productName} fill style={{ objectFit: "cover" }} />
        ) : (
          <Stack alignItems="center" justifyContent="center" height="100%">
            <Typography variant="regularS" color="text.secondary">
              Không có hình ảnh
            </Typography>
          </Stack>
        )}

        {/* Remove item button */}
        <IconButton
          onClick={() => onDelete(item.wishlistItemId)}
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            bgcolor: "rgba(255, 255, 255, 0.9)",
            color: "error.main",
            "&:hover": {
              bgcolor: "#fff",
              color: "error.dark",
            },
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Product Information */}
      <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
        <Typography variant="boldM" mb={1} sx={{ lineHeight: 1.3, display: "block" }}>
          {product.productName}
        </Typography>

        <Typography variant="boldL" color="primary.main">
          {formatPrice(price)}
        </Typography>
      </CardContent>

      {/* Actions */}
      <CardActions sx={{ p: 2.5, pt: 0, gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          size="medium"
          startIcon={<ShoppingCartIcon fontSize="small" />}
          onClick={handleAddToCart}
          sx={{ py: 1, borderRadius: 2 }}
        >
          Mua ngay
        </Button>
        <Link href={product.slug ? `/product/${product.slug}` : "/product"} style={{ width: "100%", textDecoration: "none" }}>
          <Button variant="outlined" fullWidth size="medium" sx={{ py: 1, borderRadius: 2 }}>
            Xem chi tiết
          </Button>
        </Link>
      </CardActions>
    </Card>
  );
};
