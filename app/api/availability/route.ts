import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDaySchedule } from "@/lib/availability";

// GET /api/availability?slug=john&typeId=xxx&date=2024-03-15
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");
  const typeId = searchParams.get("typeId");
  const date = searchParams.get("date");

  if (!slug || !typeId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { slug } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meetingType = await prisma.meetingType.findFirst({
    where: { id: typeId, userId: user.id, isActive: true },
  });
  if (!meetingType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const schedule = await getDaySchedule(user.id, meetingType.durationMinutes, date);
  return NextResponse.json(schedule);
}
