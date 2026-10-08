"use client";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { postEventBody } from "@e-commerce/api-validation/zod/event";
import type { PostEventBody } from "@e-commerce/api-validation/types/event";
import {
  getEventById,
  getGetEventsQueryKey,
  getGetEventByIdQueryKey,
  getGetCarouselEventsQueryKey,
  getGetPublicEventsQueryKey,
  getGetEventBySlugQueryKey,
  usePostEvent,
  usePatchEvent,
  useDeleteEvent,
} from "@e-commerce/api-client/endpoints/event";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";
import Link from "next/link";
import ConfirmDialog from "@/components/feedback/ConfirmDialog/ConfirmDialog";
import EventForm from "./EventForm";
import { toLocalDateTime, toEventPayload } from "./utils";

const formSchema = postEventBody
  .extend({
    showOnCarousel: z.boolean(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    sortOrder: z.number().int().min(0).optional(),
  })
  .refine((body) => new Date(body.endsAt) > new Date(body.startsAt), {
    path: ["endsAt"],
    message: "Ngày kết thúc phải sau ngày bắt đầu.",
  });

export default function EventEditor({ eventId }: { eventId?: string }) {
  const methods = useForm<PostEventBody>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      slug: "",
      thumbnailUrl: "",
      description: "",
      summary: "",
      startsAt: "",
      endsAt: "",
      sortOrder: 0,
      isPublished: false,
      showOnCarousel: true,
    },
  });
  const [loading, setLoading] = useState(!!eventId);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [originalSlug, setOriginalSlug] = useState("");
  const create = usePostEvent();
  const update = usePatchEvent();
  const remove = useDeleteEvent();
  const client = useQueryClient();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();
  const { reset } = methods;
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    client
      .fetchQuery({
        queryKey: getGetEventByIdQueryKey(eventId),
        queryFn: () => getEventById(eventId),
        staleTime: 0,
      })
      .then((event) => {
        if (!active) return;
        setOriginalSlug(event.slug);
        reset({
          ...event,
          startsAt: toLocalDateTime(event.startsAt),
          endsAt: toLocalDateTime(event.endsAt),
        });
      })
      .catch(() => {
        if (active) setError("Không tải được sự kiện. Vui lòng thử lại.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventId, client, reset]);
  async function invalidate(slug?: string) {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetEventsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetPublicEventsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetCarouselEventsQueryKey() }),
      ...(eventId
        ? [
            client.invalidateQueries({
              queryKey: getGetEventByIdQueryKey(eventId),
            }),
          ]
        : []),
      ...[originalSlug, slug].filter(Boolean).map((value) =>
        client.invalidateQueries({
          queryKey: getGetEventBySlugQueryKey(value!),
        }),
      ),
    ]);
  }
  const save = methods.handleSubmit(async (input) => {
    setError("");
    try {
      const data = toEventPayload(input);
      const event = eventId
        ? await update.mutateAsync({ eventId, data })
        : await create.mutateAsync({ data });
      await invalidate(event.slug);
      enqueueSnackbar("Đã lưu sự kiện", { variant: "success" });
      router.push("/admin/event");
    } catch (failure) {
      const message = (
        failure as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(message || "Không lưu được sự kiện. Vui lòng thử lại.");
    }
  });
  const busy = create.isPending || update.isPending || remove.isPending;
  if (loading) return <CircularProgress aria-label="Đang tải sự kiện" />;
  return (
    <Paper sx={{ p: { xs: 2, md: 4 } }}>
      <Typography variant="header" mb={3}>
        {eventId ? "Chỉnh sửa sự kiện" : "Tạo sự kiện"}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <FormProvider {...methods}>
        <form onSubmit={save}>
          <EventForm />
          <Stack direction="row" spacing={2} flexWrap="wrap" mt={4}>
            <Button variant="contained" type="submit" loading={busy}>
              Lưu sự kiện
            </Button>
            <Button component={Link} href="/admin/event" disabled={busy}>
              Hủy
            </Button>
            {eventId && (
              <Button
                color="error"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
              >
                Xóa sự kiện
              </Button>
            )}
          </Stack>
        </form>
      </FormProvider>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Xóa sự kiện?"
        message="Sự kiện sẽ bị xóa khỏi trang công khai và carousel."
        confirmButtonColor="error"
        confirmButtonTitle="Xóa"
        onConfirm={async () => {
          if (!eventId || busy) return;
          try {
            await remove.mutateAsync({ eventId });
            await invalidate();
            enqueueSnackbar("Đã xóa sự kiện", { variant: "success" });
            router.push("/admin/event");
          } catch {
            setError("Không xóa được sự kiện.");
          } finally {
            setConfirmOpen(false);
          }
        }}
      />
    </Paper>
  );
}
