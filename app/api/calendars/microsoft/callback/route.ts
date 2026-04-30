import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const TOKEN_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  if (!code || !userId) return new Response("Bad Request", { status: 400 });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendars/microsoft/callback`,
      scope: "User.Read Calendars.ReadWrite offline_access",
    }),
  });
  const tokens = await tokenRes.json();

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = await meRes.json();
  const accountEmail = me.mail ?? me.userPrincipalName;

  await prisma.calendarAccount.upsert({
    where: { userId_accountEmail_provider: { userId, accountEmail, provider: "microsoft" } },
    create: {
      userId,
      provider: "microsoft",
      accountEmail,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  return redirect("/dashboard/calendars?connected=microsoft");
}
