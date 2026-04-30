import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import BookingClient from "@/components/booking/BookingClient";

export default async function BookingTypePage({
  params,
}: {
  params: Promise<{ slug: string; type: string }>;
}) {
  const { slug, type: typeSlug } = await params;

  const user = await prisma.user.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, timezone: true },
  });
  if (!user) notFound();

  const meetingType = await prisma.meetingType.findFirst({
    where: { userId: user.id, slug: typeSlug, isActive: true },
  });
  if (!meetingType) notFound();

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-2xl">
        <BookingClient
          user={{ name: user.name, slug: user.slug, timezone: user.timezone }}
          meetingType={{
            id: meetingType.id,
            name: meetingType.name,
            durationMinutes: meetingType.durationMinutes,
            description: meetingType.description,
            color: meetingType.color,
            locationOptions: JSON.parse(meetingType.locationOptions ?? "[]"),
          }}
        />
      </div>
    </main>
  );
}
