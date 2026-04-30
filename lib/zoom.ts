import { prisma } from "@/lib/prisma";

const TOKEN_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

function basicAuth() {
  const creds = `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(creds).toString("base64")}`;
}

async function refreshIfNeeded(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { zoomAccessToken: true, zoomRefreshToken: true, zoomTokenExpiresAt: true },
  });
  if (!user?.zoomAccessToken || !user.zoomRefreshToken) throw new Error("Zoom not connected");

  const expiresAt = user.zoomTokenExpiresAt?.getTime() ?? 0;
  if (Date.now() < expiresAt - 5 * 60 * 1000) return user.zoomAccessToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.zoomRefreshToken }),
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed: ${res.status}`);
  const data = await res.json();

  await prisma.user.update({
    where: { id: userId },
    data: {
      zoomAccessToken: data.access_token,
      zoomRefreshToken: data.refresh_token,
      zoomTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return data.access_token as string;
}

export async function createMeeting(
  userId: string,
  opts: { topic: string; startTime: Date; durationMinutes: number }
): Promise<{ joinUrl: string; meetingId: string }> {
  const token = await refreshIfNeeded(userId);

  const res = await fetch(`${API_BASE}/users/me/meetings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: opts.topic,
      type: 2, // scheduled
      start_time: opts.startTime.toISOString(),
      duration: opts.durationMinutes,
      settings: { join_before_host: true, waiting_room: false },
    }),
  });
  if (!res.ok) throw new Error(`Zoom createMeeting failed: ${res.status}`);
  const data = await res.json();
  return { joinUrl: data.join_url, meetingId: String(data.id) };
}

export async function exchangeCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/integrations/zoom/callback`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.ZOOM_CLIENT_ID!,
      client_secret: process.env.ZOOM_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom token exchange failed: ${res.status} — ${body}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
