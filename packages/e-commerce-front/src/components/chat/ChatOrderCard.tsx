import React from "react";
import { Card, CardContent, Typography, Box, Chip } from "@mui/material";

interface ChatOrderCardProps {
  order: any;
}

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Đã tạo",
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  PAID: "Đã thanh toán",
  SHIPPED: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  NOT_FOUND: "Không tìm thấy",
  ERROR: "Chưa thành công",
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "error";
    default:
      return "default";
  }
};

const ChatOrderCard: React.FC<ChatOrderCardProps> = ({ order }) => {
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
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="boldS" sx={{ color: "text.secondary" }}>
            Đơn hàng
          </Typography>
          <Chip
            size="small"
            label={
              STATUS_LABELS[order.status?.toUpperCase()] ||
              order.status ||
              "Chưa có trạng thái"
            }
            color={getStatusColor(order.status) as any}
            sx={{ fontSize: "0.7rem", height: 20 }}
          />
        </Box>

        <Typography variant="regularS" sx={{ mb: 1, wordBreak: "break-all" }}>
          ID: <b>{order.orderId || order.id}</b>
        </Typography>

        {order.totalAmount !== undefined && (
          <Box
            sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="regularXs" color="text.secondary">
              Tổng tiền:
            </Typography>
            <Typography variant="boldS">
              {order.totalAmount
                ? new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(order.totalAmount)
                : "0 ₫"}
            </Typography>
          </Box>
        )}

        {order.totalDiscount !== undefined && (
          <Box
            sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}
          >
            <Typography variant="regularXs" color="text.secondary">
              Giảm giá:
            </Typography>
            <Typography variant="regularS" color="error.main">
              {order.totalDiscount
                ? "-" +
                  new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(order.totalDiscount)
                : "0 ₫"}
            </Typography>
          </Box>
        )}

        {order.finalAmount !== undefined && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mt: 1,
              pt: 1,
              borderTop: "1px dashed #eee",
            }}
          >
            <Typography variant="boldS">Thành tiền:</Typography>
            <Typography variant="boldM" color="primary.main">
              {order.finalAmount
                ? new Intl.NumberFormat("vi-VN", {
                    style: "currency",
                    currency: "VND",
                  }).format(order.finalAmount)
                : "0 ₫"}
            </Typography>
          </Box>
        )}
        {order.message && (
          <Typography variant="regularS" sx={{ whiteSpace: "pre-wrap" }}>
            {order.message}
          </Typography>
        )}

        {order.createdAt && (
          <Typography
            variant="regularXs"
            color="text.secondary"
            sx={{ mt: 1, display: "block", textAlign: "right" }}
          >
            Ngày đặt: {new Date(order.createdAt).toLocaleDateString("vi-VN")}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

export default ChatOrderCard;
