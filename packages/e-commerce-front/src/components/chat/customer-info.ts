import { z } from "zod";

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_ADDRESS_LENGTH = 10;
const MAX_ADDRESS_LENGTH = 500;

export const customerInfoSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(MIN_NAME_LENGTH, "Nhập tên người nhận (ít nhất 2 ký tự)")
    .max(MAX_NAME_LENGTH, "Tên quá dài"),
  phone_number: z
    .string()
    .trim()
    .regex(
      /^(0[35789]\d{8}|\+84[35789]\d{8})$/,
      "Nhập số điện thoại Việt Nam hợp lệ",
    ),
  shipping_address: z
    .string()
    .trim()
    .min(MIN_ADDRESS_LENGTH, "Nhập địa chỉ đầy đủ (ít nhất 10 ký tự)")
    .max(MAX_ADDRESS_LENGTH, "Địa chỉ quá dài"),
  payment_method: z.enum(["COD", "CREDIT_CARD"]),
});

export type CustomerInfo = z.infer<typeof customerInfoSchema>;

export function customerInfoMessage(
  info: CustomerInfo,
  productId?: string,
  quantity?: number,
) {
  return [
    "Thông tin nhận hàng của tôi (hãy cho tôi kiểm tra đơn trước khi xác nhận đặt hàng):",
    productId ? `Mã phân loại đã chọn: ${productId}` : "",
    quantity ? `Số lượng đã chọn: ${quantity}` : "",
    `Người nhận: ${info.customer_name}`,
    `Số điện thoại: ${info.phone_number}`,
    `Địa chỉ giao hàng: ${info.shipping_address}`,
    `Phương thức thanh toán: ${info.payment_method}`,
  ]
    .filter(Boolean)
    .join("\n");
}
