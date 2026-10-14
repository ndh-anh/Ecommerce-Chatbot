"use client";

import { useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { useQuery } from "@tanstack/react-query";
import { getSuggestSearchKeywordsSuspenseQueryOptions } from "@e-commerce/api-client/endpoints/product";
import useDebounce from "@/hooks/useDebounce";

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const SUGGESTION_LIMIT = 6;
const CACHE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
interface Props {
  value: string;
  onInputChange: (value: string) => void;
  onSearch: (keyword: string) => void;
}

interface ViewProps extends Props {
  keywords: string[];
  loading?: boolean;
  error?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

type Option = { label: string; keyword: string; kind: "keyword" | "search" };

export function KeywordSearchAutocomplete({
  value,
  onInputChange,
  onSearch,
  keywords,
  loading,
  error,
  onOpen,
  onClose,
}: ViewProps) {
  const keyword = value.trim();
  const options: Option[] =
    keyword.length >= MIN_QUERY_LENGTH
      ? [
          ...keywords.map(
            (term): Option => ({ kind: "keyword", label: term, keyword: term }),
          ),
          {
            kind: "search",
            label: `Tìm tất cả kết quả cho “${keyword}”`,
            keyword,
          },
        ]
      : [];

  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      openOnFocus
      value={null}
      inputValue={value}
      options={options}
      filterOptions={(items) => items}
      getOptionLabel={(option) =>
        typeof option === "string" ? option : option.label
      }
      getOptionKey={(option) =>
        typeof option === "string" ? option : `${option.kind}:${option.keyword}`
      }
      onOpen={onOpen}
      onClose={onClose}
      onInputChange={(_, input, reason) => {
        if (reason === "input" || reason === "clear") onInputChange(input);
      }}
      onChange={(event, selection) => {
        if (!selection) return;
        // Prevent the surrounding form from navigating a second time on Enter.
        event.preventDefault();
        const selectedKeyword =
          typeof selection === "string" ? selection.trim() : selection.keyword;
        onInputChange(selectedKeyword);
        onSearch(selectedKeyword);
      }}
      clearText="Xóa từ khóa"
      sx={{
        flex: { xs: "1 0 100%", sm: 1 },
        minWidth: 0,
        order: { xs: 2, sm: 0 },
        "& .MuiAutocomplete-inputRoot.MuiOutlinedInput-root": {
          pr: 1,
          flexWrap: "nowrap",
        },
        "& .MuiAutocomplete-endAdornment": {
          position: "static",
          transform: "none",
        },
      }}
      renderOption={({ key, ...optionProps }, option) => (
        <Box
          component="li"
          key={key}
          {...optionProps}
          sx={{ gap: 1.5, alignItems: "center" }}
        >
          <SearchRoundedIcon
            fontSize="small"
            sx={{ color: "text.secondary" }}
          />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="regularS" sx={{ overflowWrap: "anywhere" }}>
              {option.label}
            </Typography>
            {option.kind === "search" && (
              <Typography
                variant="regularXs"
                color="text.secondary"
                sx={{ display: "block" }}
              >
                {loading
                  ? "Đang tìm gợi ý…"
                  : error
                    ? "Chưa tải được gợi ý. Bạn vẫn có thể tìm kiếm."
                    : keywords.length
                      ? "Xem trang kết quả tìm kiếm"
                      : "Chưa có gợi ý. Nhấn Enter để tìm kiếm."}
              </Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Tìm kiếm sản phẩm..."
          slotProps={{
            htmlInput: {
              ...params.inputProps,
              "aria-label": "Tìm kiếm sản phẩm",
              autoComplete: "off",
              maxLength: 100,
            },
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && (
                    <CircularProgress size={20} aria-label="Đang tìm gợi ý" />
                  )}
                  {params.InputProps.endAdornment}
                  <Button
                    type="submit"
                    variant="contained"
                    aria-label="Tìm kiếm"
                    sx={{ minWidth: 0, px: 1.5, ml: 0.5 }}
                  >
                    <SearchRoundedIcon fontSize="small" />
                  </Button>
                </>
              ),
            },
          }}
          sx={{
            "& .MuiOutlinedInput-root": {
              bgcolor: "grey.50",
              borderRadius: 2,
              "&.Mui-focused": { bgcolor: "background.paper" },
            },
          }}
        />
      )}
    />
  );
}

export default function ProductSearchInput(props: Props) {
  const [focused, setFocused] = useState(false);
  const keyword = props.value.trim();
  const debouncedKeyword = useDebounce(keyword, DEBOUNCE_MS);
  const ready =
    keyword.length >= MIN_QUERY_LENGTH && keyword === debouncedKeyword;
  const { data, isFetching, isError } = useQuery({
    ...getSuggestSearchKeywordsSuspenseQueryOptions(
      { keyword: debouncedKeyword, limit: SUGGESTION_LIMIT },
      { request: { timeout: REQUEST_TIMEOUT_MS } },
    ),
    enabled: focused && ready,
    staleTime: CACHE_MS,
    retry: false,
  });

  return (
    <KeywordSearchAutocomplete
      {...props}
      keywords={ready ? (data?.suggestions ?? []) : []}
      loading={
        focused && keyword.length >= MIN_QUERY_LENGTH && (!ready || isFetching)
      }
      error={ready && isError}
      onOpen={() => setFocused(true)}
      onClose={() => setFocused(false)}
    />
  );
}
