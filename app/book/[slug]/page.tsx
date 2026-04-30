import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function BookingIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const user = await prisma.user.findUnique({
    where: { slug },
    select: { name: true, slug: true },
  });
  if (!user) notFound();

  const meetingTypes = await prisma.meetingType.findMany({
    where: { userId: (await prisma.user.findUnique({ where: { slug } }))!.id, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-2xl font-bold text-blue-600">
            {(user.name ?? slug)[0].toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{user.name ?? slug}</h1>
          <p className="text-gray-500">Select a meeting type to get started.</p>
        </div>

        {meetingTypes.length === 0 ? (
          <p className="text-center text-gray-400">No meeting types available.</p>
        ) : (
          <div className="space-y-3">
            {meetingTypes.map((type) => (
              <Link
                key={type.id}
                href={`/book/${slug}/${type.slug}`}
                className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ background: type.color }} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                      {type.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {type.durationMinutes} minutes
                      {type.description && ` · ${type.description}`}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
