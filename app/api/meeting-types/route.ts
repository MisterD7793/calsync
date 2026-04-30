import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  durationMinutes: z.number().min(30).multipleOf(30),
  description: z.string().optional(),
  color: z.string().optional(),
  isActive: z.boolean().optional(),
  locationOptions: z.array(z.object({
    type: z.string(),
    value: z.string().optional(),
    label: z.string(),
  })).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const types = await prisma.meetingType.findMany({ where: { userId: session.user.id } });
  return NextResponse.json(types);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const { locationOptions, ...rest } = parsed.data;
  const type = await prisma.meetingType.create({
    data: {
      ...rest,
      userId: session.user.id,
      ...(locationOptions !== undefined && { locationOptions: JSON.stringify(locationOptions) }),
    },
  });
  return NextResponse.json(type);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, locationOptions, ...data } = await req.json();
  const type = await prisma.meetingType.findFirst({ where: { id, userId: session.user.id } });
  if (!type) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.meetingType.update({
    where: { id },
    data: {
      ...data,
      ...(locationOptions !== undefined && { locationOptions: JSON.stringify(locationOptions) }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.meetingType.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}
