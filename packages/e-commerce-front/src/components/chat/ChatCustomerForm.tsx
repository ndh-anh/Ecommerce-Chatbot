"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  customerInfoSchema,
  customerInfoMessage,
  type CustomerInfo,
} from "./customer-info";

interface Props {
  productId?: string;
  quantity?: number;
  disabled?: boolean;
  onSendMessage: (text: string) => Promise<void>;
}

export default function ChatCustomerForm({
  productId,
  quantity,
  disabled,
  onSendMessage,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInfo>({
    resolver: zodResolver(customerInfoSchema),
    defaultValues: {
      customer_name: "",
      phone_number: "",
      shipping_address: "",
      payment_method: "COD",
    },
  });
  const locked = disabled || isSubmitting;

  return (
    <Box
      component="form"
      noValidate
      onSubmit={handleSubmit(async (info) => {
        await onSendMessage(customerInfoMessage(info, productId, quantity));
      })}
      sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}
    >
      <Typography variant="boldS">Thông tin người nhận</Typography>
      <TextField
        label="Họ tên người nhận"
        size="small"
        autoComplete="shipping name"
        required
        disabled={locked}
        {...register("customer_name")}
        error={Boolean(errors.customer_name)}
        helperText={errors.customer_name?.message}
      />
      <TextField
        label="Số điện thoại"
        size="small"
        type="tel"
        autoComplete="shipping tel"
        required
        disabled={locked}
        {...register("phone_number")}
        error={Boolean(errors.phone_number)}
        helperText={errors.phone_number?.message}
      />
      <TextField
        label="Địa chỉ giao hàng"
        size="small"
        autoComplete="shipping street-address"
        multiline
        minRows={2}
        required
        disabled={locked}
        {...register("shipping_address")}
        error={Boolean(errors.shipping_address)}
        helperText={errors.shipping_address?.message}
      />
      <Controller
        name="payment_method"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            select
            label="Thanh toán"
            size="small"
            disabled={locked}
          >
            <MenuItem value="COD">Thanh toán khi nhận hàng</MenuItem>
            <MenuItem value="CREDIT_CARD">Thẻ tín dụng</MenuItem>
          </TextField>
        )}
      />
      <Typography variant="regularXs" color="text.secondary">
        Gửi thông tin để xem lại đơn. Bạn sẽ xác nhận đặt hàng ở bước tiếp theo.
      </Typography>
      <Button type="submit" variant="contained" disabled={locked}>
        Gửi thông tin nhận hàng
      </Button>
    </Box>
  );
}
