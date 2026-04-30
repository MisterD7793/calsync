import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MeetingTypesClient from "@/components/admin/MeetingTypesClient";

export default async function MeetingTypesPage() {
  const session = await auth();
  const userId = session!.user!.id!;
  const types = await prisma.meetingType.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meeting Types</h1>
        <p className="text-gray-500 mt-1">Each type gets its own booking link. Duration is in 30-minute increments.</p>
      </div>
      <MeetingTypesClient types={types} />
    </div>
  );
}
