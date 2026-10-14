import React from "react";
import {
  Card,
  CardMedia,
  CardContent,
  Typography,
  CardActions,
  Button,
  Box,
  Chip,
} from "@mui/material";

interface ChatVariantCardProps {
  variant: any;
  onOrder: (sku: string) => void;
  disabled?: boolean;
}

const ChatVariantCard: React.FC<ChatVariantCardProps> = ({
  variant,
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
        {variant.thumbnailUrl ? (
          <CardMedia
            component="img"
            image={variant.thumbnailUrl}
            alt={variant.sku}
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
            Chưa có ảnh
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
          title={variant.sku}
        >
          SKU: {variant.sku}
        </Typography>
        {variant.variant_name && (
          <Typography variant="regularS">{variant.variant_name}</Typography>
        )}

        {variant.variantAttributes && variant.variantAttributes.length > 0 && (
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
            {variant.variantAttributes.map((attr: any, i: number) => (
              <Chip
                key={i}
                size="small"
                label={`${attr.attributeName}: ${attr.attributeValue}`}
                sx={{ fontSize: "0.7rem" }}
              />
            ))}
          </Box>
        )}

        <Typography variant="boldM" sx={{ color: "error.main", mb: 1 }}>
          {variant.price
            ? new Intl.NumberFormat("vi-VN", {
                style: "currency",
                currency: "VND",
              }).format(variant.price)
            : "Liên hệ"}
        </Typography>
        <Typography variant="regularXs" sx={{ color: "text.secondary" }}>
          Tồn kho: {variant.stock ?? 0}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: 1.5, pt: 1, gap: 1 }}>
        <Button
          disabled={disabled || (variant.stock ?? 0) <= 0}
          onClick={() => onOrder(variant.sku)}
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
          Chọn phân loại này
        </Button>
      </CardActions>
    </Card>
  );
};

export default ChatVariantCard;
