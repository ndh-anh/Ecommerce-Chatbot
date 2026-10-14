import React, { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Search from "./Search";
import ProductSearchInput, {
  KeywordSearchAutocomplete,
} from "./ProductSearchInput";

const { search, push } = vi.hoisted(() => ({ search: vi.fn(), push: vi.fn() }));
vi.mock("@e-commerce/api-client/endpoints/product", () => ({
  getSuggestSearchKeywordsSuspenseQueryOptions: (params: unknown) => ({
    queryKey: ["suggestions", params],
    queryFn: () => search(params),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ userId: null }) }));
vi.mock("@/hooks/useCart", () => ({ useCartBadge: () => 0 }));
const TIMERS = { settle: 400, beforeDebounce: 299, crossDebounce: 2 };

const suggestion = "Áo polo cotton";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function View({ value = "áo", submit = vi.fn(), searchAll = vi.fn() }) {
  const [input, setInput] = useState(value);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <KeywordSearchAutocomplete
        value={input}
        onInputChange={setInput}
        keywords={[suggestion]}
        onSearch={searchAll}
      />
    </form>
  );
}

describe("search keyword suggestions", () => {
  it("searches the selected keyword from the header", async () => {
    search.mockResolvedValue({ suggestions: [suggestion] });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <Search />
      </QueryClientProvider>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "áo" } });
    fireEvent.click(
      await screen.findByRole("option", { name: /Áo polo cotton/ }),
    );
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith(
      "/search?keyword=%C3%81o%20polo%20cotton",
    );
    client.clear();
  });

  it("submits a keyword using the search button", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <Search />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "  áo cotton  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/search?keyword=%C3%A1o%20cotton"),
    );
    expect(push).toHaveBeenCalledOnce();
    client.clear();
  });
  it("selects a keyword with the keyboard without submitting the form twice", () => {
    const submit = vi.fn(),
      searchAll = vi.fn();
    render(<View submit={submit} searchAll={searchAll} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(searchAll).toHaveBeenCalledOnce();
    expect(searchAll).toHaveBeenCalledWith(suggestion);
    expect(submit).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe(suggestion);
  });

  it("searches the typed keyword on Enter without selecting a suggestion", () => {
    const searchAll = vi.fn(),
      submit = vi.fn();
    render(
      <View value="  áo cotton  " searchAll={searchAll} submit={submit} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(searchAll).toHaveBeenCalledOnce();
    expect(searchAll).toHaveBeenCalledWith("áo cotton");
    expect(submit).not.toHaveBeenCalled();
  });

  it("selects a keyword with a click and does not filter accent-insensitive server suggestions", () => {
    const searchAll = vi.fn();
    render(<View value="ao" searchAll={searchAll} />);
    fireEvent.focus(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: suggestion }));
    expect(searchAll).toHaveBeenCalledWith(suggestion);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("still offers full search when suggestions fail", () => {
    const searchAll = vi.fn();
    render(
      <KeywordSearchAutocomplete
        value="áo"
        keywords={[]}
        error
        onInputChange={vi.fn()}
        onSearch={searchAll}
      />,
    );
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getByText(/Chưa tải được gợi ý/)).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Tìm tất cả kết quả/ }));
    expect(searchAll).toHaveBeenCalledWith("áo");
  });

  it("debounces queries, skips short input and hides results for a previous keyword", async () => {
    vi.useFakeTimers();
    search.mockResolvedValue({ suggestions: [suggestion] });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Connected() {
      const [input, setInput] = useState("");
      return (
        <ProductSearchInput
          value={input}
          onInputChange={setInput}
          onSearch={vi.fn()}
        />
      );
    }
    render(
      <QueryClientProvider client={client}>
        <Connected />
      </QueryClientProvider>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "á" } });
    await act(() => vi.advanceTimersByTimeAsync(TIMERS.settle));
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "áo" } });
    fireEvent.change(input, { target: { value: "áo polo" } });
    await act(() => vi.advanceTimersByTimeAsync(TIMERS.beforeDebounce));
    expect(search).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(TIMERS.crossDebounce));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith({
      keyword: "áo polo",
      limit: 6,
    });
    expect(screen.getByRole("option", { name: /Áo polo cotton/ })).toBeTruthy();
    fireEvent.change(input, { target: { value: "điện thoại" } });
    expect(screen.queryByRole("option", { name: /Áo polo cotton/ })).toBeNull();
    fireEvent.change(input, { target: { value: "" } });
    await act(() => vi.advanceTimersByTimeAsync(TIMERS.settle));
    expect(search).toHaveBeenCalledOnce();
    client.clear();
  });
});
