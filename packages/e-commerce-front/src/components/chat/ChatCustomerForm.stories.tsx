import type { Meta, StoryObj } from "@storybook/react";
import ChatCustomerForm from "./ChatCustomerForm";

const meta = {
  title: "Chat/CustomerForm",
  component: ChatCustomerForm,
  args: {
    productId: "variant-preview",
    quantity: 2,
    onSendMessage: async () => {},
  },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ChatCustomerForm>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Recipient: Story = {};
export const Submitted: Story = { args: { disabled: true } };
