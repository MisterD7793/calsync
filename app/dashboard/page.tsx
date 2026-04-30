import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, calendarCount, meetingTypeCount, upcomingBookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { slug: true, name: true } }),
    prisma.calendarAccount.count({ where: { userId } }),
    prisma.meetingType.count({ where: { userId, isActive: true } }),
    prisma.booking.count({
      where: { userId, status: "confirmed", startTime: { gte: new Date() } },
    }),
  ]);

  const bookingUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/book/${user?.slug}`;
  const hasMain = await prisma.calendarAccount.count({ where: { userId, isMain: true } });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-gray-500 mt-1">Your booking link is ready to share.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-sm font-medium text-gray-700">Your booking page</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 truncate">
            {bookingUrl}
          </code>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Preview
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Calendars connected", value: calendarCount, href: "/dashboard/calendars" },
          { label: "Meeting types", value: meetingTypeCount, href: "/dashboard/meeting-types" },
          { label: "Upcoming bookings", value: upcomingBookings, href: "/dashboard/bookings" },
        ].map(({ label, value, href }) => (
          <Link key={label} href={href} className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition-colors">
            <p className="text-3xl font-bold text-gray-900">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {(!calendarCount || !hasMain || !meetingTypeCount) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <p className="font-medium text-amber-900">Complete your setup</p>
          <ul className="space-y-2 text-sm text-amber-800">
            {!calendarCount && (
              <li>→ <Link href="/dashboard/calendars" className="underline">Connect at least one calendar</Link></li>
            )}
            {calendarCount > 0 && !hasMain && (
              <li>→ <Link href="/dashboard/calendars" className="underline">Set a main calendar for new bookings</Link></li>
            )}
            {!meetingTypeCount && (
              <li>→ <Link href="/dashboard/meeting-types" className="underline">Create a meeting type</Link></li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
