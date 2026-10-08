"use client";
import { useGetPublicEventsSuspense } from "@e-commerce/api-client/endpoints/event";
import type { GetPublicEventsQueryParams } from "@e-commerce/api-validation/types/event";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Grid,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
const labels = {
  upcoming: "Sắp diễn ra",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
  draft: "Bản nháp",
};
export default function EventList({
  params,
}: {
  params: GetPublicEventsQueryParams;
}) {
  const { data } = useGetPublicEventsSuspense(params, {
    query: { refetchInterval: 60000 },
  });
  const router = useRouter();
  return (
    <Stack spacing={3} sx={{ py: 4 }}>
      <Typography variant="title" component="h1">
        Sự kiện
      </Typography>
      {!data.events.length && (
        <Typography color="text.secondary">
          Chưa có sự kiện được xuất bản.
        </Typography>
      )}
      <Grid container spacing={3}>
        {data.events.map((event) => (
          <Grid key={event.eventId} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%" }}>
              <CardActionArea component={Link} href={`/event/${event.slug}`}>
                <CardMedia
                  component="img"
                  image={event.thumbnailUrl}
                  alt={event.title}
                  sx={{ aspectRatio: "16 / 9", objectFit: "cover" }}
                />
                <CardContent>
                  <Chip
                    size="small"
                    label={labels[event.status]}
                    color={event.status === "active" ? "success" : "default"}
                  />
                  <Typography variant="boldL" component="h2" mt={1}>
                    {event.title}
                  </Typography>
                  {event.summary && (
                    <Typography color="text.secondary" mt={1}>
                      {event.summary}
                    </Typography>
                  )}
                  <Typography variant="regularS" mt={2}>
                    {new Date(event.startsAt).toLocaleDateString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}{" "}
                    –{" "}
                    {new Date(event.endsAt).toLocaleDateString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
      {data.totalPages > 1 && (
        <Box display="flex" justifyContent="center">
          <Pagination
            count={data.totalPages}
            page={params.page}
            onChange={(_, page) =>
              router.push(`/event?page=${page}&pageSize=${params.pageSize}`)
            }
          />
        </Box>
      )}
    </Stack>
  );
}
