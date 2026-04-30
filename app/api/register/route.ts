import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const Schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  slug: z.string().min(2).max(32).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, email, password, slug } = parsed.data;

  const [existingEmail, existingSlug] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { slug } }),
  ]);

  if (existingEmail) return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  if (existingSlug) return NextResponse.json({ error: "That URL is already taken" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { name, email, passwordHash, slug } });

  return NextResponse.json({ ok: true });
}
