import { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google-calendar";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const userId = searchParams.get("state");
  if (!code || !userId) return new Response("Bad Request", { status: 400 });

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  const accountEmail = data.email!;

  await prisma.calendarAccount.upsert({
    where: { userId_accountEmail_provider: { userId, accountEmail, provider: "google" } },
    create: {
      userId,
      provider: "google",
      accountEmail,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
    },
    update: {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: new Date(tokens.expiry_date ?? Date.now() + 3600 * 1000),
    },
  });

  return redirect("/dashboard/calendars?connected=google");
}
