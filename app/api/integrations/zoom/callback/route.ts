import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCode } from "@/lib/zoom";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/dashboard/settings", process.env.NEXT_PUBLIC_BASE_URL!));

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/dashboard/settings?zoom=error", process.env.NEXT_PUBLIC_BASE_URL!));

  try {
    const { accessToken, refreshToken, expiresAt } = await exchangeCode(code);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { zoomAccessToken: accessToken, zoomRefreshToken: refreshToken, zoomTokenExpiresAt: expiresAt },
    });
  } catch (e) {
    console.error("Zoom OAuth error:", String(e));
    return NextResponse.redirect(new URL("/dashboard/settings?zoom=error", process.env.NEXT_PUBLIC_BASE_URL!));
  }

  return NextResponse.redirect(new URL("/dashboard/settings?zoom=connected", process.env.NEXT_PUBLIC_BASE_URL!));
}
