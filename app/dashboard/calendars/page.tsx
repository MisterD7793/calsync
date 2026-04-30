import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarsClient from "@/components/admin/CalendarsClient";
import * as Google from "@/lib/google-calendar";
import * as Microsoft from "@/lib/microsoft-calendar";

export default async function CalendarsPage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const accounts = await prisma.calendarAccount.findMany({ where: { userId } });

  const accountsWithCalendars = await Promise.all(
    accounts.map(async (account) => {
      let calendars: { id: string; name: string; primary: boolean }[] = [];
      try {
        calendars =
          account.provider === "google"
            ? await Google.listCalendars(account)
            : await Microsoft.listCalendars(account);
      } catch {}
      return {
        id: account.id,
        provider: account.provider,
        accountEmail: account.accountEmail,
        isMain: account.isMain,
        mainCalId: account.mainCalId,
        watchCalIds: JSON.parse(account.watchCalIds) as string[],
        calendars,
      };
    })
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendars</h1>
        <p className="text-gray-500 mt-1">
          Connect accounts to block busy times. Set one calendar as &quot;main&quot; to receive new bookings.
        </p>
      </div>
      <div className="flex gap-3">
        <a
          href="/api/calendars/google/connect"
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Connect Google
        </a>
        <a
          href="/api/calendars/microsoft/connect"
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Connect Microsoft
        </a>
      </div>
      <CalendarsClient accounts={accountsWithCalendars} />
    </div>
  );
}
