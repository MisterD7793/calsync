import { prisma } from "@/lib/prisma";
import type { CalendarAccount } from "@prisma/client";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`;
const AUTH_URL = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`;

export function getAuthUrl(userId: string) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendars/microsoft/callback`,
    scope: "User.Read Calendars.ReadWrite offline_access",
    state: userId,
    prompt: "consent",
  });
  return `${AUTH_URL}?${params}`;
}

async function refreshIfNeeded(account: CalendarAccount): Promise<string> {
  if (account.expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return account.accessToken;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: account.refreshToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed (${res.status}): ${JSON.stringify(data)}`);
  }
  const newExpiry = new Date(Date.now() + data.expires_in * 1000);
  await prisma.calendarAccount.update({
    where: { id: account.id },
    data: { accessToken: data.access_token, expiresAt: newExpiry },
  });
  return data.access_token;
}

async function graphGet(token: string, path: string) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Graph API error ${res.status}: ${path}`);
  return res.json();
}

async function graphRequest(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Graph API error ${res.status}: ${path}`);
  if (res.status === 204 || res.status === 404) return null;
  return res.json();
}

export async function listCalendars(account: CalendarAccount) {
  const token = await refreshIfNeeded(account);
  const data = await graphGet(token, "/me/calendars?$select=id,name,isDefaultCalendar");
  return (data.value ?? []).map((c: { id: string; name: string; isDefaultCalendar: boolean }) => ({
    id: c.id,
    name: c.name,
    primary: c.isDefaultCalendar ?? false,
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
  const token = await refreshIfNeeded(account);

  const res = await fetch(`${GRAPH_BASE}/me/calendar/getSchedule`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schedules: [account.accountEmail],
      startTime: { dateTime: timeMin.toISOString(), timeZone: "UTC" },
      endTime: { dateTime: timeMax.toISOString(), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  });

  const data = await res.json();
  const intervals: BusyInterval[] = [];

  for (const schedule of data.value ?? []) {
    for (const item of schedule.scheduleItems ?? []) {
      if (item.status !== "free") {
        intervals.push({
          start: new Date(item.start.dateTime + "Z"),
          end: new Date(item.end.dateTime + "Z"),
        });
      }
    }
  }
  return intervals;
}

export interface RemoteEvent {
  id: string;
  start: Date;
  end: Date;
  updated: string;
  cancelled: boolean;
  allDay: boolean;
}

export async function listEvents(
  account: CalendarAccount,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<RemoteEvent[]> {
  const token = await refreshIfNeeded(account);
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $select: "id,start,end,lastModifiedDateTime,showAs,isAllDay",
    $top: "250",
  });
  const data = await graphGet(token, `/me/calendars/${calendarId}/calendarView?${params}`);

  return (data.value ?? [])
    .filter((e: { showAs?: string }) => e.showAs !== "free")
    .map(
      (e: {
        id: string;
        start: { dateTime: string };
        end: { dateTime: string };
        lastModifiedDateTime: string;
        isAllDay?: boolean;
      }) => ({
        id: e.id,
        // All-day events are floating dates; keep just the date as UTC midnight.
        start: new Date(e.isAllDay ? e.start.dateTime.slice(0, 10) : e.start.dateTime + "Z"),
        end: new Date(e.isAllDay ? e.end.dateTime.slice(0, 10) : e.end.dateTime + "Z"),
        updated: e.lastModifiedDateTime,
        cancelled: false,
        allDay: !!e.isAllDay,
      })
    );
}

// Outlook pins all-day events to a time zone and shows times when it differs
// from the viewer's, so all-day blocks are created in the user's zone.
function eventTimes(start: Date, end: Date, allDay: boolean, timeZone: string) {
  if (!allDay) {
    return {
      start: { dateTime: start.toISOString(), timeZone: "UTC" },
      end: { dateTime: end.toISOString(), timeZone: "UTC" },
    };
  }
  return {
    isAllDay: true,
    start: { dateTime: start.toISOString().slice(0, 10) + "T00:00:00", timeZone },
    end: { dateTime: end.toISOString().slice(0, 10) + "T00:00:00", timeZone },
  };
}

export async function createBusyBlock(
  account: CalendarAccount,
  calendarId: string,
  start: Date,
  end: Date,
  title: string,
  allDay: boolean,
  timeZone: string
): Promise<string> {
  const token = await refreshIfNeeded(account);
  const data = await graphRequest(token, "POST", `/me/calendars/${calendarId}/events`, {
    subject: title,
    ...eventTimes(start, end, allDay, timeZone),
    showAs: "busy",
  });
  return data.id;
}

export async function updateBusyBlock(
  account: CalendarAccount,
  calendarId: string,
  eventId: string,
  start: Date,
  end: Date,
  allDay: boolean,
  timeZone: string
): Promise<void> {
  const token = await refreshIfNeeded(account);
  await graphRequest(
    token,
    "PATCH",
    `/me/calendars/${calendarId}/events/${eventId}`,
    eventTimes(start, end, allDay, timeZone)
  );
}

export async function deleteEvent(account: CalendarAccount, calendarId: string, eventId: string): Promise<void> {
  const token = await refreshIfNeeded(account);
  await graphRequest(token, "DELETE", `/me/calendars/${calendarId}/events/${eventId}`);
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
    addTeams?: boolean;
    location?: string;
  }
): Promise<{ eventId: string | null; conferenceLink: string | null }> {
  const token = await refreshIfNeeded(account);

  const res = await fetch(`${GRAPH_BASE}/me/calendars/${calendarId}/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: params.title,
      body: { contentType: "text", content: params.description ?? "" },
      location: params.location ? { displayName: params.location } : undefined,
      start: { dateTime: params.start.toISOString(), timeZone: "UTC" },
      end: { dateTime: params.end.toISOString(), timeZone: "UTC" },
      attendees: [
        {
          emailAddress: { address: params.bookerEmail, name: params.bookerName },
          type: "required",
        },
      ],
      ...(params.addTeams && {
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
      }),
    }),
  });

  const data = await res.json();
  const conferenceLink = data.onlineMeeting?.joinUrl ?? null;
  return { eventId: data.id ?? null, conferenceLink };
}
