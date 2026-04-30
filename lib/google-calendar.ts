import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import type { CalendarAccount } from "@prisma/client";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendars/google/callback`
  );
}

export function getAuthUrl(userId: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: userId,
  });
}

async function getAuthedClient(account: CalendarAccount) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt.getTime(),
  });

  // Refresh if expiring within 5 minutes
  if (account.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    const { credentials } = await client.refreshAccessToken();
    await prisma.calendarAccount.update({
      where: { id: account.id },
      data: {
        accessToken: credentials.access_token ?? account.accessToken,
        expiresAt: new Date(credentials.expiry_date ?? Date.now() + 3600 * 1000),
      },
    });
    client.setCredentials(credentials);
  }

  return client;
}

export async function listCalendars(account: CalendarAccount) {
  const auth = await getAuthedClient(account);
  const cal = google.calendar({ version: "v3", auth });
  const res = await cal.calendarList.list({ minAccessRole: "writer" });
  return (res.data.items ?? []).map((c) => ({
    id: c.id!,
    name: c.summary ?? c.id!,
    primary: c.primary ?? false,
  }));
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export async function getFreeBusy(
  account: CalendarAccount,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<BusyInterval[]> {
  if (calendarIds.length === 0) return [];
  const auth = await getAuthedClient(account);
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: calendarIds.map((id) => ({ id })),
    },
  });

  const intervals: BusyInterval[] = [];
  for (const calId of calendarIds) {
    const busy = res.data.calendars?.[calId]?.busy ?? [];
    for (const b of busy) {
      if (b.start && b.end) {
        intervals.push({ start: new Date(b.start), end: new Date(b.end) });
      }
    }
  }
  return intervals;
}

export async function createEvent(
  account: CalendarAccount,
  calendarId: string,
  params: {
    title: string;
    start: Date;
    end: Date;
    bookerName: string;
    bookerEmail: string;
    description?: string;
    addMeet?: boolean;
    location?: string;
  }
): Promise<{ eventId: string | null; conferenceLink: string | null }> {
  const auth = await getAuthedClient(account);
  const cal = google.calendar({ version: "v3", auth });

  const res = await cal.events.insert({
    calendarId,
    sendUpdates: "all",
    conferenceDataVersion: params.addMeet ? 1 : 0,
    requestBody: {
      summary: params.title,
      description: params.description,
      location: params.location,
      start: { dateTime: params.start.toISOString() },
      end: { dateTime: params.end.toISOString() },
      attendees: [{ email: params.bookerEmail, displayName: params.bookerName }],
      ...(params.addMeet && {
        conferenceData: {
          createRequest: { requestId: `calsync-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } },
        },
      }),
    },
  });

  const conferenceLink = res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? null;
  return { eventId: res.data.id ?? null, conferenceLink };
}
