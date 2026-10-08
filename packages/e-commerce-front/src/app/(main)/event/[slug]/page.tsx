import {
  getEventBySlug,
  getGetEventBySlugQueryKey,
} from "@e-commerce/api-client/endpoints/event";
import { getQueryClient } from "@/utils/query";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import { Box, Chip, Stack, Typography, Button } from "@mui/material";
import Link from "next/link";
export const dynamic = "force-dynamic";
const load = cache(async (slug: string) => {
  const client = getQueryClient();
  try {
    return await client.fetchQuery({
      queryKey: getGetEventBySlugQueryKey(slug),
      queryFn: () => getEventBySlug(slug),
    });
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status === 404)
      notFound();
    throw error;
  }
});
export async function generateMetadata({
  params,
}: PageProps<"/event/[slug]">): Promise<Metadata> {
  const event = await load((await params).slug);
  return {
    title: event.title,
    description: event.summary,
    openGraph: {
      title: event.title,
      description: event.summary,
      images: [event.thumbnailUrl],
    },
  };
}
export default async function Page({ params }: PageProps<"/event/[slug]">) {
  const event = await load((await params).slug);
  const labels = {
    upcoming: "Sắp diễn ra",
    active: "Đang diễn ra",
    ended: "Đã kết thúc",
    draft: "Bản nháp",
  };
  const format = (value: string) =>
    new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date(value));
  return (
    <Stack
      component="article"
      spacing={3}
      sx={{ py: 4, maxWidth: 1000, mx: "auto" }}
    >
      <Button component={Link} href="/event" sx={{ alignSelf: "flex-start" }}>
        ← Tất cả sự kiện
      </Button>
      <Typography
        component="h1"
        variant="title"
        sx={{ fontSize: { xs: "2rem", md: "3rem" } }}
      >
        {event.title}
      </Typography>
      <Chip
        label={labels[event.status]}
        color={event.status === "active" ? "success" : "default"}
        sx={{ alignSelf: "flex-start" }}
      />
      <Typography color="text.secondary">
        {format(event.startsAt)} – {format(event.endsAt)} (giờ Việt Nam)
      </Typography>
      <Box
        component="img"
        src={event.thumbnailUrl}
        alt={event.title}
        sx={{
          width: "100%",
          maxHeight: 500,
          objectFit: "cover",
          borderRadius: 2,
        }}
      />
      {event.summary && (
        <Typography variant="boldL">{event.summary}</Typography>
      )}
      <Box
        className="ql-snow"
        sx={{
          "& .ql-editor": { p: 0, fontSize: "1rem", lineHeight: 1.8 },
          "& img": { maxWidth: "100%", height: "auto" },
          "& a": { color: "primary.main" },
          "& h1, & h2, & h3": { fontWeight: 700, my: 2 },
          "& p": { my: 1 },
          "& ol": { pl: 3, listStyle: "decimal" },
          "& ul, & li[data-list='bullet']": { listStyle: "disc" },
          "& ul": { pl: 3 },
          "& blockquote": {
            pl: 2,
            borderLeft: "3px solid",
            borderColor: "divider",
          },
          "& .ql-align-center": { textAlign: "center" },
          "& .ql-align-right": { textAlign: "right" },
          "& .ql-align-justify": { textAlign: "justify" },
        }}
      >
        <div
          className="ql-editor"
          dangerouslySetInnerHTML={{ __html: event.description }}
        />
      </Box>
    </Stack>
  );
}
