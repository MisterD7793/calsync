import {
  startOfDay,
  endOfDay,
  addMinutes,
  isAfter,
  isBefore,
  max,
  min,
  parseISO,
  format,
} from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import * as Google from "@/lib/google-calendar";
import * as Microsoft from "@/lib/microsoft-calendar";

export interface TimeSlot {
  start: string; // ISO string
  end: string;
}

export interface DaySchedule {
  slots: TimeSlot[];
  busyIntervals: TimeSlot[];
  workingHours: { start: string; end: string } | null;
  timezone: string;
}

interface Interval {
  start: Date;
  end: Date;
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = max([last.end, sorted[i].end]);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

function subtractIntervals(free: Interval, busy: Interval[]): Interval[] {
  let remaining: Interval[] = [free];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const r of remaining) {
      if (b.end <= r.start || b.start >= r.end) {
        next.push(r);
      } else {
        if (b.start > r.start) next.push({ start: r.start, end: b.start });
        if (b.end < r.end) next.push({ start: b.end, end: r.end });
      }
    }
    remaining = next;
  }
  return remaining;
}

type WorkingHours = Record<
  string,
  { enabled: boolean; start: string; end: string }
>;

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function getAvailableSlots(
  userId: string,
  durationMinutes: number,
  date: string // YYYY-MM-DD in the user's timezone
): Promise<TimeSlot[]> {
  return (await getDaySchedule(userId, durationMinutes, date)).slots;
}

export async function getDaySchedule(
  userId: string,
  durationMinutes: number,
  date: string
): Promise<DaySchedule> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { calendarAccounts: true },
  });
  const empty: DaySchedule = { slots: [], busyIntervals: [], workingHours: null, timezone: "UTC" };
  if (!user) return empty;

  const wh: WorkingHours = JSON.parse(user.workingHours);
  const tz = user.timezone;

  const localDay = toZonedTime(parseISO(date), tz);
  const dayKey = DAY_KEYS[localDay.getDay()];
  const dayConfig = wh[dayKey];
  if (!dayConfig?.enabled) return { ...empty, timezone: tz };

  const [startHour, startMin] = dayConfig.start.split(":").map(Number);
  const [endHour, endMin] = dayConfig.end.split(":").map(Number);

  const dayStart = fromZonedTime(
    new Date(localDay.getFullYear(), localDay.getMonth(), localDay.getDate(), startHour, startMin),
    tz
  );
  const dayEnd = fromZonedTime(
    new Date(localDay.getFullYear(), localDay.getMonth(), localDay.getDate(), endHour, endMin),
    tz
  );

  // Fetch busy intervals from all accounts
  const allBusy: Interval[] = [];
  for (const account of user.calendarAccounts) {
    const calIds: string[] = JSON.parse(account.watchCalIds);
    if (calIds.length === 0) continue;
    try {
      let busy: Interval[];
      if (account.provider === "google") {
        busy = await Google.getFreeBusy(account, calIds, dayStart, dayEnd);
      } else {
        busy = await Microsoft.getFreeBusy(account, calIds, dayStart, dayEnd);
      }
      allBusy.push(...busy);
    } catch {
      // Skip accounts with auth errors rather than failing entirely
    }
  }

  // Add buffer around existing bookings
  const existingBookings = await prisma.booking.findMany({
    where: {
      userId,
      status: "confirmed",
      startTime: { gte: startOfDay(dayStart) },
      endTime: { lte: endOfDay(dayEnd) },
    },
  });
  for (const b of existingBookings) {
    allBusy.push({
      start: addMinutes(b.startTime, -user.bufferMinutes),
      end: addMinutes(b.endTime, user.bufferMinutes),
    });
  }

  const merged = mergeIntervals(allBusy);
  const freeWindows = subtractIntervals({ start: dayStart, end: dayEnd }, merged);

  const slots: TimeSlot[] = [];
  const now = addMinutes(new Date(), 30);

  for (const window of freeWindows) {
    let cursor = window.start;
    while (true) {
      const slotEnd = addMinutes(cursor, durationMinutes);
      if (isAfter(slotEnd, window.end)) break;
      if (isAfter(cursor, now) || cursor >= now) {
        slots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }
      cursor = addMinutes(cursor, durationMinutes);
    }
  }

  // Clip busy intervals to working hours for display
  const displayBusy = merged
    .filter((b) => b.end > dayStart && b.start < dayEnd)
    .map((b) => ({
      start: (b.start < dayStart ? dayStart : b.start).toISOString(),
      end: (b.end > dayEnd ? dayEnd : b.end).toISOString(),
    }));

  return {
    slots,
    busyIntervals: displayBusy,
    workingHours: { start: dayStart.toISOString(), end: dayEnd.toISOString() },
    timezone: tz,
  };
}
