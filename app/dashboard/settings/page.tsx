import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "@/components/admin/SettingsClient";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ zoom?: string }> }) {
  const session = await auth();
  const { zoom } = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id! },
    select: { name: true, email: true, slug: true, timezone: true, bufferMinutes: true, workingHours: true, zoomAccessToken: true },
  });

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <SettingsClient
        initial={{
          ...user!,
          workingHours: JSON.parse(user!.workingHours),
          zoomConnected: !!user!.zoomAccessToken,
          zoomStatus: zoom,
        }}
      />
    </div>
  );
}
