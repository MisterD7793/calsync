import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export default async function BookingsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const [user, bookings] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
    prisma.booking.findMany({
      where: { userId },
      include: { meetingType: true },
      orderBy: { startTime: "desc" },
      take: 100,
    }),
  ]);

  const tz = user?.timezone ?? "UTC";

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500">No bookings yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Who</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const start = toZonedTime(b.startTime, tz);
                return (
                  <tr key={b.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">
                      {format(start, "MMM d, yyyy")}
                      <span className="text-gray-400 ml-2">{format(start, "h:mm a")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{b.bookerName}</p>
                      <p className="text-gray-400 text-xs">{b.bookerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{b.meetingType.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        b.status === "confirmed"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
