"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useGetEventsSuspense } from "@e-commerce/api-client/endpoints/event";
import type { EventSummary } from "@e-commerce/api-client/schemas/event";
import DataGrid from "@/components/data-display/DataGrid/DataGrid";
import type { GridColDef } from "@mui/x-data-grid";
import { Chip, Stack } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { eventSearchContext, eventStatusLabels } from "./utils";
import type { ToolbarButton } from "@/components/data-display/DataGrid/components/Toolbar/types";

export default function EventGrid() {
  const { params, setParams, setParam } = eventSearchContext.useSearch();
  const { data, isFetching } = useGetEventsSuspense(params, {
    query: { refetchInterval: 60000 },
  });
  const [selected, setSelected] = useState<EventSummary>();
  const router = useRouter();
  const columns: GridColDef<EventSummary>[] = [
    { field: "title", headerName: "Tiêu đề", flex: 1, minWidth: 180 },
    {
      field: "slug",
      headerName: "Slug",
      flex: 1,
      minWidth: 150,
      sortable: false,
    },
    {
      field: "status",
      headerName: "Trạng thái",
      width: 140,
      sortable: false,
      renderCell: ({ row }) => (
        <Chip
          size="small"
          label={eventStatusLabels[row.status]}
          color={row.status === "active" ? "success" : "default"}
        />
      ),
    },
    {
      field: "startsAt",
      headerName: "Bắt đầu",
      width: 180,
      valueFormatter: (value: string) =>
        new Date(value).toLocaleString("vi-VN"),
    },
    {
      field: "endsAt",
      headerName: "Kết thúc",
      width: 180,
      valueFormatter: (value: string) =>
        new Date(value).toLocaleString("vi-VN"),
    },
    { field: "sortOrder", headerName: "Thứ tự", width: 100 },
    {
      field: "showOnCarousel",
      headerName: "Carousel",
      width: 100,
      sortable: false,
      renderCell: ({ row }) => (row.showOnCarousel ? "Có" : "Không"),
    },
  ];
  const buttons = useMemo(() => {
    const actions: ToolbarButton[] = [
      {
        label: "Thêm sự kiện",
        startIcon: <AddIcon />,
        action: () => router.push("/admin/event/new"),
      },
    ];
    if (selected)
      actions.push({
        label: "Chỉnh sửa",
        action: () => router.push(`/admin/event/${selected.eventId}`),
      });
    if (selected?.isPublished)
      actions.push({
        label: "Xem trang công khai",
        action: () =>
          window.open(
            `/event/${selected.slug}`,
            "_blank",
            "noopener,noreferrer",
          ),
      });
    return actions;
  }, [selected, router]);
  return (
    <Stack sx={{ height: "calc(100vh - 350px)", minHeight: 350 }}>
      <DataGrid
        columns={columns}
        rows={data.events.map((event) => ({ ...event, id: event.eventId }))}
        rowCount={data.totalCount}
        page={params.page}
        pageSize={params.pageSize}
        orderBy={params.orderBy}
        loading={isFetching}
        paginationModelChange={(model) =>
          setParams({ page: model.page + 1, pageSize: model.pageSize })
        }
        orderByChange={(value) => setParam("orderBy", value)}
        onRowClick={({ row }) =>
          setSelected((previous) =>
            previous?.eventId === row.eventId ? undefined : row,
          )
        }
        onRowDoubleClick={({ row }) =>
          router.push(`/admin/event/${row.eventId}`)
        }
        slotProps={{ toolbar: { leftButtons: buttons } }}
      />
    </Stack>
  );
}
