"use client";

import { useEffect, Suspense } from "react";
import ProductSearchInput from "./ProductSearchInput";
import Stack from "@mui/material/Stack";
import { Controller, useForm } from "react-hook-form";
import LocalMallIcon from "@mui/icons-material/LocalMall";
import { useRouter, useSearchParams } from "next/navigation";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Badge from "@mui/material/Badge";
import NextLink from "next/link";
import { useCartBadge } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

const SearchBar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userId } = useAuth();

  const textSearchParam = searchParams.get("keyword") || "";

  const badgeCount = useCartBadge(userId);

  const { control, handleSubmit, reset } = useForm<{ textSearch: string }>({
    defaultValues: {
      textSearch: textSearchParam,
    },
  });

  useEffect(() => {
    reset({
      textSearch: textSearchParam,
    });
  }, [textSearchParam, reset]);

  const handleSearch = (data: { textSearch: string }) => {
    const query = data.textSearch.trim();
    if (query !== "") {
      router.push(`/search?keyword=${encodeURIComponent(query)}`);
    } else {
      router.push(`/search`);
    }
  };

  return (
    <Box className="w-full bg-white border-b border-gray-100 transition-all duration-300">
      <Stack
        component={"form"}
        onSubmit={handleSubmit(handleSearch)}
        direction={"row"}
        alignItems={"center"}
        justifyContent={"space-between"}
        spacing={{ xs: 1, sm: 4 }}
        useFlexGap
        sx={{ flexWrap: { xs: "wrap", sm: "nowrap" }, py: { xs: 1, sm: 0 } }}
        className="max-w-7xl mx-auto px-4 md:px-8 min-h-20"
      >
        <Stack
          width={{ xs: "auto", sm: 240 }}
          component={NextLink}
          href="/"
          sx={{
            textDecoration: "none",
            color: "text.primary",
          }}
        >
          <Typography
            variant="title"
            sx={{
              color: "text.primary",
              letterSpacing: "-0.5px",
              fontSize: "1.6rem",
            }}
          >
            E-Commerce
          </Typography>
        </Stack>
        <Controller
          control={control}
          name="textSearch"
          render={({ field }) => (
            <ProductSearchInput
              value={field.value}
              onInputChange={field.onChange}
              onSearch={(keyword) => handleSearch({ textSearch: keyword })}
            />
          )}
        />
        <Stack>
          <Tooltip title="Giỏ hàng">
            <IconButton
              component={NextLink}
              href="/cart"
              className="bg-gray-50 hover:bg-gray-100 transition-colors"
              sx={{ width: 48, height: 48, color: "text.primary" }}
            >
              <Badge badgeContent={badgeCount} color={"error"}>
                <LocalMallIcon sx={{ fontSize: 24 }} />
              </Badge>
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
};

const Search = () => {
  return (
    <Suspense
      fallback={
        <Box className="w-full bg-white border-b border-gray-200">
          <Stack
            direction={"row"}
            alignItems={"center"}
            justifyContent={"space-between"}
            spacing={4}
            className="max-w-7xl mx-auto px-4 md:px-8 h-20"
          >
            <Stack width={240}>LOGO</Stack>
            <Stack flexGrow={1} />
            <Stack width={48} height={48} />
          </Stack>
        </Box>
      }
    >
      <SearchBar />
    </Suspense>
  );
};

export default Search;
