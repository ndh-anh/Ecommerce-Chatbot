import React from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
  Button,
  Box,
} from "@mui/material";
import Link from "next/link";

interface ChatProductCardProps {
  product: any;
  onOrder: (productName: string) => void;
  disabled?: boolean;
}

const ChatProductCard: React.FC<ChatProductCardProps> = ({
  product,
  onOrder,
  disabled,
}) => {
  return (
    <Card
      sx={{
        display: "flex",
        flexDirection: "column",
        mb: 1,
        boxShadow: 1,
        border: "1px solid #eee",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: 128,
          bgcolor: "grey.100",
        }}
      >
        {product.thumbnailUrl ? (
          <CardMedia
            component="img"
            image={product.thumbnailUrl}
            alt={product.productName}
            sx={{ height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "grey.400",
              typography: "regularXs",
            }}
          >
            No Image
          </Box>
        )}
      </Box>
      <CardContent sx={{ p: 1.5, pb: 0 }}>
        <Typography
          variant="boldS"
          sx={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            lineHeight: 1.2,
            mb: 1,
          }}
          title={product.productName}
        >
          {product.productName}
        </Typography>
        <Typography variant="boldM" sx={{ color: "error.main", mb: 1 }}>
          {product.price
            ? new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(product.price)
            : "Liên hệ"}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 1.5, pt: 0, gap: 1 }}>
        <Button
          disabled={disabled}
          component={Link}
          href={`/product/${product.slug}`}
          variant="contained"
          size="small"
          fullWidth
          sx={{
            bgcolor: "grey.200",
            color: "text.primary",
            "&:hover": { bgcolor: "grey.300" },
            textTransform: "none",
          }}
          disableElevation
        >
          Chi tiết
        </Button>
        <Button
          onClick={() => onOrder(product.productName)}
          variant="contained"
          size="small"
          fullWidth
          sx={{
            bgcolor: "common.black",
            color: "common.white",
            "&:hover": { bgcolor: "grey.800" },
            textTransform: "none",
          }}
        >
          Đặt hàng
        </Button>
      </CardActions>
    </Card>
  );
};

export default ChatProductCard;
