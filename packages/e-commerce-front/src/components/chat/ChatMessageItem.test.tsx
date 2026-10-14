import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import ChatMessageItem from "./ChatMessageItem";

afterEach(cleanup);

describe("chat business interactions", () => {
  it("validates recipient details and sends a form without confirming an order", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(
      <ChatMessageItem
        msg={{
          id: "form",
          sender: "ai",
          text: "Điền thông tin",
          type: "request_customer_info",
          data: { form: "customer_info", product_id: "v1", quantity: 2 },
        }}
        isLatest
        onSendMessage={send}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi thông tin nhận hàng" }),
    );
    await screen.findByText("Nhập số điện thoại Việt Nam hợp lệ");
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Họ tên người nhận/), {
      target: { value: "Nguyễn Văn A" },
    });
    fireEvent.change(screen.getByLabelText(/Số điện thoại/), {
      target: { value: "0912345678" },
    });
    fireEvent.change(screen.getByLabelText(/Địa chỉ giao hàng/), {
      target: { value: "123 Nguyễn Trãi, Hà Nội" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Gửi thông tin nhận hàng" }),
    );
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send.mock.calls[0]).toHaveLength(1);
    expect(send.mock.calls[0][0]).toContain("Mã phân loại đã chọn: v1");
    expect(send.mock.calls[0][0]).toContain("Số điện thoại: 0912345678");
    expect(send.mock.calls[0][0]).toContain("Số lượng đã chọn: 2");
  });

  it("restores confirmation controls using data and sends explicit rejection", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    render(
      <ChatMessageItem
        msg={{
          id: "confirm",
          sender: "ai",
          text: "Kiểm tra đơn hàng",
          data: {
            confirmation: true,
            actions: [
              {
                name: "place_order_tool",
                args: {
                  customer_name: "Nguyễn Văn A",
                  phone_number: "0912345678",
                  payment_method: "COD",
                  quantity: 2,
                },
              },
            ],
          },
        }}
        isLatest
        onSendMessage={send}
      />,
    );
    expect(screen.getByText(/Người nhận: Nguyễn Văn A/)).toBeTruthy();
    expect(screen.queryByText(/"customer_name"/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Từ chối" }));
    expect(send).toHaveBeenCalledWith("Từ chối", false);
  });

  it("prevents acting on an old confirmation", () => {
    const send = vi.fn();
    render(
      <ChatMessageItem
        msg={{
          id: "old",
          sender: "ai",
          text: "Xác nhận",
          type: "CONFIRM_place_order_tool",
        }}
        isLatest={false}
        onSendMessage={send}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Xác nhận",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(send).not.toHaveBeenCalled();
  });

  it("renders snake_case order results without raw JSON or invented amounts", () => {
    render(
      <ChatMessageItem
        msg={{
          id: "order",
          sender: "ai",
          text: "Đã đặt hàng",
          data: {
            order_id: "o1",
            status: "PENDING",
            message: "Đặt hàng thành công",
          },
        }}
        onSendMessage={vi.fn()}
      />,
    );
    expect(screen.getByText("o1")).toBeTruthy();
    expect(screen.getByText("Đặt hàng thành công")).toBeTruthy();
    expect(screen.queryByText("0 ₫")).toBeNull();
    expect(screen.queryByText(/"order_id"/)).toBeNull();
  });

  it("shows a legacy plain text tool result", () => {
    render(
      <ChatMessageItem
        msg={{
          id: "legacy",
          sender: "ai",
          text: "Kết quả",
          data: "Đặt hàng thành công",
        }}
        onSendMessage={vi.fn()}
      />,
    );
    expect(screen.getByText("Đặt hàng thành công")).toBeTruthy();
  });
});
