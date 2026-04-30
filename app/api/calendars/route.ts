import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as Google from "@/lib/google-calendar";
import * as Microsoft from "@/lib/microsoft-calendar";

// GET /api/calendars — list all connected accounts with their calendars
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.calendarAccount.findMany({
    where: { userId: session.user.id },
  });

  const result = await Promise.all(
    accounts.map(async (account) => {
      let calendars: { id: string; name: string; primary: boolean }[] = [];
      try {
        if (account.provider === "google") {
          calendars = await Google.listCalendars(account);
        } else {
          calendars = await Microsoft.listCalendars(account);
        }
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

  return NextResponse.json(result);
}

// PATCH /api/calendars — update which calendars to watch / set main
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, watchCalIds, isMain, mainCalId } = await req.json();

  const account = await prisma.calendarAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isMain) {
    // Clear main flag from all other accounts first
    await prisma.calendarAccount.updateMany({
      where: { userId: session.user.id },
      data: { isMain: false, mainCalId: null },
    });
  }

  const updated = await prisma.calendarAccount.update({
    where: { id: accountId },
    data: {
      ...(watchCalIds !== undefined && { watchCalIds: JSON.stringify(watchCalIds) }),
      ...(isMain !== undefined && { isMain }),
      ...(mainCalId !== undefined && { mainCalId }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/calendars?id=...
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.calendarAccount.deleteMany({
    where: { id, userId: session.user.id },
  });
  return NextResponse.json({ ok: true });
}
