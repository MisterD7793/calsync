import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import CancelButton from "./CancelButton";

export default async function CancelPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { meetingType: true, user: { select: { timezone: true, name: true } } },
  });
  if (!booking) notFound();

  const tz = booking.user.timezone;
  const start = toZonedTime(booking.startTime, tz);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-8 space-y-6 text-center">
        {booking.status === "cancelled" ? (
          <>
            <p className="text-lg font-semibold text-gray-700">This booking is already cancelled.</p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-gray-900">Cancel booking?</h1>
            <p className="text-gray-600">
              <strong>{booking.meetingType.name}</strong> with {booking.user.name ?? "the host"}
              <br />
              {format(start, "EEEE, MMMM d")} at {format(start, "h:mm a")}
            </p>
            <CancelButton bookingId={id} />
          </>
        )}
      </div>
    </main>
  );
}
