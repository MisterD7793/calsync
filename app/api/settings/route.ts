import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const WorkingDaySchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
});

const Schema = z.object({
  name: z.string().optional(),
  timezone: z.string().optional(),
  bufferMinutes: z.number().min(0).max(60).optional(),
  workingHours: z.record(z.string(), WorkingDaySchema).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, slug: true, timezone: true, bufferMinutes: true, workingHours: true },
  });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { workingHours, ...rest } = parsed.data;
  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...rest,
      ...(workingHours && { workingHours: JSON.stringify(workingHours) }),
    },
    select: { name: true, email: true, slug: true, timezone: true, bufferMinutes: true, workingHours: true },
  });
  return NextResponse.json(user);
}
