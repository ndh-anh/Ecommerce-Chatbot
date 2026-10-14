import { useState } from "react";
import type { ComponentProps } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import Box from "@mui/material/Box";
import { KeywordSearchAutocomplete } from "./ProductSearchInput";

function Preview(props: ComponentProps<typeof KeywordSearchAutocomplete>) {
  const [value, setValue] = useState(props.value);
  return (
    <Box
      component="form"
      onSubmit={(event) => event.preventDefault()}
      sx={{ maxWidth: 600 }}
    >
      <KeywordSearchAutocomplete
        {...props}
        value={value}
        onInputChange={setValue}
      />
    </Box>
  );
}

const meta = {
  title: "Layout/KeywordSearch",
  component: KeywordSearchAutocomplete,
  render: (args) => <Preview {...args} />,
  args: {
    value: "áo",
    onInputChange: () => {},
    onSearch: () => {},
    keywords: ["Áo polo", "Áo thun", "Áo khoác"],
  },
} satisfies Meta<typeof KeywordSearchAutocomplete>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Suggestions: Story = {};
export const Loading: Story = { args: { keywords: [], loading: true } };
export const NoResults: Story = { args: { keywords: [] } };
export const Unavailable: Story = { args: { keywords: [], error: true } };
