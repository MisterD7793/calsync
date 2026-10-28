import { addDays, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import * as Google from "@/lib/google-calendar";
import * as Microsoft from "@/lib/microsoft-calendar";
import type { CalendarAccount, MirroredBlock } from "@prisma/client";

export const MAX_SYNC_WINDOW_DAYS = 120;
const MIRROR_TITLE = "Busy";

function providerFor(account: CalendarAccount) {
  return account.provider === "google" ? Google : Microsoft;
}

async function deleteMirror(mainAccount: CalendarAccount, mirror: MirroredBlock) {
  try {
    await providerFor(mainAccount).deleteEvent(mainAccount, mainAccount.mainCalId!, mirror.mainEventId);
  } catch {
    // Remote event may already be gone; still clear our record.
  }
  await prisma.mirroredBlock.delete({ where: { id: mirror.id } });
}

export async function syncBlocksForUser(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { calendarAccounts: true },
  });
  if (!user) return;

  const mainAccount = user.calendarAccounts.find((a) => a.isMain && a.mainCalId);
  if (!mainAccount) return;

  const existingMirrors = await prisma.mirroredBlock.findMany({ where: { userId } });
  const mirrorByKey = new Map(
    existingMirrors.map((m) => [`${m.sourceAccountId}:${m.sourceCalId}:${m.sourceEventId}`, m])
  );
  const ourMainEventIds = new Set(existingMirrors.map((m) => m.mainEventId));

  const windowDays = Math.min(user.blockSyncWindowDays, MAX_SYNC_WINDOW_DAYS);
  const now = new Date();
  const timeMin = subDays(now, windowDays);
  const timeMax = addDays(now, windowDays);
  const seenKeys = new Set<string>();

  for (const account of user.calendarAccounts) {
    const mirrorCalIds: string[] = JSON.parse(account.mirrorCalIds);
    for (const calId of mirrorCalIds) {
      if (account.id === mainAccount.id && calId === mainAccount.mainCalId) continue;

      let events;
      try {
        events = await providerFor(account).listEvents(account, calId, timeMin, timeMax);
      } catch (err) {
        console.error(`[block-sync] listEvents failed for ${account.provider}:${calId}`, err);
        continue; // auth error on this account; skip and retry next cycle
      }

      for (const ev of events) {
        if (ourMainEventIds.has(ev.id)) continue; // don't re-mirror our own blocks
        const key = `${account.id}:${calId}:${ev.id}`;
        let existing = mirrorByKey.get(key);

        if (ev.cancelled) {
          if (existing) await deleteMirror(mainAccount, existing);
          continue;
        }

        // Switching between timed and all-day can't be patched cleanly
        // (and repairs mirrors created before all-day support): recreate.
        if (existing && existing.allDay !== ev.allDay) {
          await deleteMirror(mainAccount, existing);
          existing = undefined;
        }

        seenKeys.add(key);

        if (!existing) {
          try {
            const mainEventId = await providerFor(mainAccount).createBusyBlock(
              mainAccount,
              mainAccount.mainCalId!,
              ev.start,
              ev.end,
              MIRROR_TITLE,
              ev.allDay,
              user.timezone
            );
            await prisma.mirroredBlock.create({
              data: {
                userId,
                sourceAccountId: account.id,
                sourceCalId: calId,
                sourceEventId: ev.id,
                sourceUpdatedAt: ev.updated,
                startTime: ev.start,
                endTime: ev.end,
                allDay: ev.allDay,
                mainAccountId: mainAccount.id,
                mainEventId,
              },
            });
          } catch (err) {
            console.error(`[block-sync] createBusyBlock failed`, err);
            continue; // couldn't create; retry next pass
          }
        } else if (existing.sourceUpdatedAt !== ev.updated) {
          try {
            await providerFor(mainAccount).updateBusyBlock(
              mainAccount,
              mainAccount.mainCalId!,
              existing.mainEventId,
              ev.start,
              ev.end,
              ev.allDay,
              user.timezone
            );
            await prisma.mirroredBlock.update({
              where: { id: existing.id },
              data: { sourceUpdatedAt: ev.updated, startTime: ev.start, endTime: ev.end },
            });
          } catch {
            // Mirror event may have been edited/deleted out-of-band; drop our
            // record so a fresh block gets created cleanly next pass.
            await prisma.mirroredBlock.delete({ where: { id: existing.id } }).catch(() => {});
          }
        }
      }
    }
  }

  for (const existing of existingMirrors) {
    if (existing.startTime < timeMin) continue; // outside this cycle's window; leave as permanent history
    const key = `${existing.sourceAccountId}:${existing.sourceCalId}:${existing.sourceEventId}`;
    if (!seenKeys.has(key)) {
      await deleteMirror(mainAccount, existing);
    }
  }
}

export async function syncBlocksForAllUsers(): Promise<void> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    try {
      await syncBlocksForUser(u.id);
    } catch {
      // One user's failure shouldn't block the rest of the sync pass.
    }
  }
}

export async function removeMirrorsForAccount(accountId: string): Promise<void> {
  const mirrors = await prisma.mirroredBlock.findMany({
    where: { sourceAccountId: accountId },
    include: { mainAccount: true },
  });
  for (const m of mirrors) {
    await deleteMirror(m.mainAccount, m);
  }
}

// Deletes every mirrored Busy block this feature has created for the user
// (from their main calendar) and clears mirrorCalIds so nothing gets
// recreated — a full undo, independent of touching any account connection.
export async function removeAllMirrorsForUser(userId: string): Promise<number> {
  const mirrors = await prisma.mirroredBlock.findMany({
    where: { userId },
    include: { mainAccount: true },
  });
  for (const m of mirrors) {
    await deleteMirror(m.mainAccount, m);
  }
  await prisma.calendarAccount.updateMany({
    where: { userId },
    data: { mirrorCalIds: "[]" },
  });
  return mirrors.length;
}
