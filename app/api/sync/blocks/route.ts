import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncBlocksForUser, removeAllMirrorsForUser } from "@/lib/block-sync";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await syncBlocksForUser(session.user.id);
  return NextResponse.json({ ok: true });
}

// Removes every mirrored Busy block this feature created and turns mirroring
// off for all calendars — the undo button.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const removed = await removeAllMirrorsForUser(session.user.id);
  return NextResponse.json({ ok: true, removed });
}
