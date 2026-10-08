"use client";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import type { PostEventBody } from "@e-commerce/api-validation/types/event";
import TextField from "@/components/inputs/TextField/TextField";
import ImagePicker from "@/components/inputs/ImagePicker/ImagePicker";
import UploadImageViewer from "@/components/data-display/UploadImageViewer/UploadImageViewer";
import useUpload from "@/hooks/useUpload";
import dynamic from "next/dynamic";
import {
  Box,
  Grid,
  Typography,
  FormControlLabel,
  Switch,
  FormHelperText,
  TextField as MuiTextField,
} from "@mui/material";
const RichTextEditor = dynamic(
  () => import("@/components/inputs/RichTextEditor/RichTextEditor"),
  { ssr: false },
);

export default function EventForm() {
  const { control, setValue, setError } = useFormContext<PostEventBody>();
  const thumbnail = useWatch({ control, name: "thumbnailUrl" });
  const { handleUpload } = useUpload();
  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          control={control}
          name="title"
          label="Tiêu đề sự kiện"
          required
          fullWidth
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          control={control}
          name="slug"
          label="Slug"
          required
          fullWidth
          helperText="Chữ thường, số và dấu gạch nối. Ví dụ: sale-he-2026"
        />
      </Grid>
      <Grid size={12}>
        <TextField
          control={control}
          name="summary"
          label="Tóm tắt trên carousel"
          multiline
          minRows={2}
          fullWidth
          helperText="Tối đa 500 ký tự; mô tả ngắn để người xem hiểu nội dung sự kiện."
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          control={control}
          name="startsAt"
          label="Ngày giờ bắt đầu"
          type="datetime-local"
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TextField
          control={control}
          name="endsAt"
          label="Ngày giờ kết thúc"
          type="datetime-local"
          required
          fullWidth
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Grid>
      <Grid size={12}>
        <Typography variant="regularS" color="text.secondary">
          Thời gian theo múi giờ của thiết bị. Carousel hiển thị từ lúc bắt đầu
          đến trước lúc kết thúc.
        </Typography>
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          control={control}
          name="sortOrder"
          render={({ field, fieldState }) => (
            <MuiTextField
              {...field}
              value={field.value ?? 0}
              onChange={(event) =>
                field.onChange(
                  event.target.value === "" ? 0 : Number(event.target.value),
                )
              }
              label="Thứ tự hiển thị"
              type="number"
              fullWidth
              error={!!fieldState.error}
              helperText={fieldState.error?.message || "Số nhỏ hiển thị trước."}
              slotProps={{ htmlInput: { min: 0, step: 1 } }}
            />
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          control={control}
          name="isPublished"
          render={({ field }) => (
            <FormControlLabel
              label="Xuất bản sự kiện"
              control={
                <Switch
                  checked={!!field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              }
            />
          )}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 4 }}>
        <Controller
          control={control}
          name="showOnCarousel"
          render={({ field }) => (
            <FormControlLabel
              label="Hiển thị trên carousel"
              control={
                <Switch
                  checked={!!field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
              }
            />
          )}
        />
      </Grid>
      <Grid size={12}>
        <Typography mb={1}>
          Thumbnail / banner (nên dùng ảnh ngang 16:9)
        </Typography>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {thumbnail && (
            <UploadImageViewer
              url={thumbnail}
              onDelete={() =>
                setValue("thumbnailUrl", "", { shouldValidate: true })
              }
            />
          )}
          <Controller
            control={control}
            name="thumbnailUrl"
            render={({ field, fieldState }) => (
              <ImagePicker
                field={field}
                fieldError={fieldState.error}
                setError={setError}
              />
            )}
          />
        </Box>
        <TextField
          control={control}
          name="thumbnailUrl"
          label="URL thumbnail"
          required
          fullWidth
          helperText="Tải ảnh lên hoặc nhập URL HTTP/HTTPS."
        />
      </Grid>
      <Grid size={12}>
        <Typography mb={2}>Nội dung sự kiện</Typography>
        <Controller
          control={control}
          name="description"
          render={({ field, fieldState }) => (
            <>
              <RichTextEditor
                value={field.value}
                onChange={field.onChange}
                onImageUpload={handleUpload}
              />
              {fieldState.error && (
                <FormHelperText error>
                  {fieldState.error.message}
                </FormHelperText>
              )}
            </>
          )}
        />
      </Grid>
    </Grid>
  );
}
