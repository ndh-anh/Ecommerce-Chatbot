import EventEditor from "@/features/admin/event/EventEditor";
export default async function Page({
  params,
}: PageProps<"/admin/event/[eventId]">) {
  const { eventId } = await params;
  return <EventEditor eventId={eventId} />;
}
