import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import type { Message } from "./types";
import ChatProductCard from "./ChatProductCard";
import ChatVariantCard from "./ChatVariantCard";
import ChatOrderCard from "./ChatOrderCard";
import ChatCustomerForm from "./ChatCustomerForm";

interface Props {
  msg: Message;
  disabled?: boolean;
  isLatest?: boolean;
  onSendMessage: (text: string, confirm?: boolean) => Promise<void>;
}

const labels: Record<string, string> = {
  customer_name: "Người nhận",
  phone_number: "Số điện thoại",
  shipping_address: "Địa chỉ giao hàng",
  payment_method: "Thanh toán",
  quantity: "Số lượng",
  product_id: "Mã phân loại",
  order_id: "Mã đơn hàng",
  reason: "Lý do hủy",
  message: "Thông báo",
  status: "Trạng thái",
  description: "Mô tả",
  policy: "Chính sách",
  content: "Nội dung",
  title: "Tiêu đề",
  name: "Tên",
  stock: "Tồn kho",
};

function readable(value: unknown): string {
  if (value === "COD") return "Thanh toán khi nhận hàng";
  if (value === "CREDIT_CARD") return "Thẻ tín dụng";
  if (Array.isArray(value))
    return value.map(readable).filter(Boolean).join("\n");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .flatMap(([key, item]) =>
        labels[key] && item !== null
          ? [`${labels[key]}: ${readable(item)}`]
          : [],
      )
      .join("\n");
  }
  return value == null ? "" : String(value);
}

function decode(value: unknown): any {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(
      value.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1"),
    );
  } catch {
    return value;
  }
}

export default function ChatMessageItem({
  msg,
  onSendMessage,
  disabled,
  isLatest,
}: Props) {
  const isUser = msg.sender === "user";
  const data = decode(msg.data);
  const parsedText = isUser ? msg.text : decode(msg.text);
  const text =
    typeof parsedText === "string" ? parsedText : readable(parsedText);
  const isConfirmation =
    !isUser && (data?.confirmation === true || msg.type?.startsWith("CONFIRM"));
  const hasForm = !isUser && !isConfirmation && data?.form === "customer_info";
  const actions =
    data?.actions || (isConfirmation && data ? [{ args: data }] : []);

  const renderData = () => {
    if (!data || hasForm) return null;
    if (isConfirmation) {
      return actions.map((action: any, index: number) => (
        <Box
          key={index}
          sx={{ mt: 1, p: 1, bgcolor: "grey.50", borderRadius: 1 }}
        >
          <Typography variant="boldS">
            {action.name === "cancel_order_tool"
              ? "Hủy đơn hàng"
              : "Thông tin cần xác nhận"}
          </Typography>
          <Typography
            variant="regularS"
            sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {readable(action.args)}
          </Typography>
        </Box>
      ));
    }
    const list = Array.isArray(data)
      ? data
      : data.data || data.orders || data.productVariants || [data];
    const items = Array.isArray(list) ? list : [list];
    return (
      <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((item: any, index: number) => {
          if (item?.productName)
            return (
              <ChatProductCard
                key={index}
                product={item}
                disabled={disabled}
                onOrder={() =>
                  onSendMessage(
                    `Tôi muốn đặt mua sản phẩm: ${item.productName} (product_id: ${item.productId})`,
                  )
                }
              />
            );
          if (item?.sku)
            return (
              <ChatVariantCard
                key={index}
                variant={item}
                disabled={disabled}
                onOrder={() =>
                  onSendMessage(
                    `Tôi chọn phân loại ${item.variant_name || item.sku}, variant_id: ${item.variant_id || item.variantId || item.productVariantId || item.sku}`,
                  )
                }
              />
            );
          if (item?.orderId || item?.order_id || (item?.id && item?.status))
            return (
              <ChatOrderCard
                key={index}
                order={{
                  ...item,
                  orderId: item.orderId || item.order_id || item.id,
                  totalAmount: item.totalAmount ?? item.total_amount,
                }}
              />
            );
          const summary = readable(item);
          return summary && summary !== text ? (
            <Typography
              key={index}
              variant="regularS"
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
            >
              {summary}
            </Typography>
          ) : null;
        })}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        mb: 2,
      }}
    >
      <Paper
        elevation={isUser ? 0 : 1}
        sx={{
          maxWidth: "90%",
          minWidth: hasForm ? "85%" : undefined,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isUser ? "common.black" : "common.white",
          color: isUser ? "common.white" : "text.primary",
          border: "1px solid",
          borderColor: isUser ? "common.black" : "grey.100",
        }}
      >
        <Typography
          variant="regularM"
          sx={{
            color: "inherit",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {text}
        </Typography>
        {!isUser && renderData()}
        {hasForm && (
          <ChatCustomerForm
            productId={data?.product_id}
            quantity={data?.quantity}
            disabled={disabled || !isLatest}
            onSendMessage={onSendMessage}
          />
        )}
        {isConfirmation && (
          <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              disabled={disabled || !isLatest}
              onClick={() => onSendMessage("Xác nhận", true)}
            >
              Xác nhận
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={disabled || !isLatest}
              onClick={() => onSendMessage("Từ chối", false)}
            >
              Từ chối
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
