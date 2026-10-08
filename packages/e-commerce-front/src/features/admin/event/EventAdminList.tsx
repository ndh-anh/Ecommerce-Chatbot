"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import TextField from "@/components/inputs/TextField/TextField";
import SearchProvider from "@/providers/SearchProvider/SearchProvider";
import { getEventsQueryParams } from "@e-commerce/api-validation/zod/event";
import { eventSearchContext } from "./utils";
import SuspenseWrapper from "@/components/feedback/SuspenseWrapper/SuspenseWrapper";
import dynamic from "next/dynamic";
const EventGrid = dynamic(() => import("./EventGrid"), { ssr: false });
function Filters() {
  const { params, setParams } = eventSearchContext.useSearch();
  const { control, handleSubmit, reset } = useForm<{ title: string }>({
    defaultValues: { title: params.title ?? "" },
  });
  useEffect(() => {
    reset({ title: params.title ?? "" });
  }, [params.title, reset]);
  return (
    <Box
      component="form"
      onSubmit={handleSubmit((data) =>
        setParams({ title: data.title || undefined, page: 1 }),
      )}
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
        <TextField control={control} name="title" label="Tìm theo tiêu đề" />
        <Button variant="contained" type="submit">
          Tìm kiếm
        </Button>
        <Button onClick={() => setParams({ title: undefined, page: 1 })}>
          Đặt lại
        </Button>
      </Stack>
    </Box>
  );
}
export default function EventAdminList() {
  return (
    <SearchProvider context={eventSearchContext} schema={getEventsQueryParams}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="header" mb={3}>
          Sự kiện
        </Typography>
        <Filters />
        <SuspenseWrapper>
          <EventGrid />
        </SuspenseWrapper>
      </Paper>
    </SearchProvider>
  );
}
