"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface CalendarInfo {
  id: string;
  name: string;
  primary: boolean;
}

interface AccountInfo {
  id: string;
  provider: string;
  accountEmail: string;
  isMain: boolean;
  mainCalId: string | null;
  watchCalIds: string[];
  mirrorCalIds: string[];
  calendars: CalendarInfo[];
}

export default function CalendarsClient({
  accounts,
  blockSyncWindowDays,
}: {
  accounts: AccountInfo[];
  blockSyncWindowDays: number;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const hasMainCalendar = accounts.some((a) => a.isMain && a.mainCalId);

  async function setMain(accountId: string, mainCalId: string) {
    setSaving(accountId);
    await fetch("/api/calendars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, isMain: true, mainCalId }),
    });
    setSaving(null);
    router.refresh();
  }

  async function toggleWatch(accountId: string, calId: string, currentIds: string[]) {
    const next = currentIds.includes(calId)
      ? currentIds.filter((id) => id !== calId)
      : [...currentIds, calId];
    setSaving(accountId + calId);
    await fetch("/api/calendars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, watchCalIds: next }),
    });
    setSaving(null);
    router.refresh();
  }

  async function toggleMirror(accountId: string, calId: string, currentIds: string[]) {
    const next = currentIds.includes(calId)
      ? currentIds.filter((id) => id !== calId)
      : [...currentIds, calId];
    setSaving(accountId + calId + "mirror");
    await fetch("/api/calendars", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, mirrorCalIds: next }),
    });
    setSaving(null);
    router.refresh();
  }

  async function disconnect(accountId: string) {
    if (!confirm("Disconnect this account?")) return;
    await fetch(`/api/calendars?id=${accountId}`, { method: "DELETE" });
    router.refresh();
  }

  async function syncNow() {
    setSyncing(true);
    await fetch("/api/sync/blocks", { method: "POST" });
    setSyncing(false);
    router.refresh();
  }

  async function undoAllMirrors() {
    if (!confirm("Remove every synced Busy block from your main calendar and turn off mirroring for all calendars?")) return;
    setSyncing(true);
    await fetch("/api/sync/blocks", { method: "DELETE" });
    setSyncing(false);
    router.refresh();
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-xl">
        <p className="text-gray-500">No calendars connected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasMainCalendar && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <div className="text-sm text-blue-800">
            <p>
              Calendars marked &quot;Mirror to Main&quot; get synced as Busy blocks on your main calendar every few minutes.
            </p>
            <p className="mt-1 text-blue-700">
              Events from {blockSyncWindowDays} days ago to {blockSyncWindowDays} days from now are actively
              checked each sync. Once an event falls outside that window, its Busy block stays on your main
              calendar as permanent history &mdash; it just stops updating if the source event changes.
              Adjustable in Settings.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={syncNow}
              disabled={syncing}
              className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {syncing ? "Working…" : "Sync now"}
            </button>
            <button
              onClick={undoAllMirrors}
              disabled={syncing}
              className="text-sm px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-800 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              Undo all
            </button>
          </div>
        </div>
      )}
      {accounts.map((account) => (
        <div key={account.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide px-2 py-1 rounded bg-gray-100 text-gray-600">
                {account.provider}
              </span>
              <span className="font-medium text-gray-900">{account.accountEmail}</span>
              {account.isMain && (
                <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                  Main
                </span>
              )}
            </div>
            <button
              onClick={() => disconnect(account.id)}
              className="text-sm text-red-500 hover:text-red-700"
            >
              Disconnect
            </button>
          </div>

          {account.calendars.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calendars</p>
              {account.calendars.map((cal) => {
                const isWatched = account.watchCalIds.includes(cal.id);
                const isMirrored = account.mirrorCalIds.includes(cal.id);
                const isMainCal = account.isMain && account.mainCalId === cal.id;
                const isSaving = saving === account.id + cal.id || saving === account.id;
                const isMirrorSaving = saving === account.id + cal.id + "mirror";

                return (
                  <div key={cal.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={isWatched}
                        disabled={!!isSaving}
                        onChange={() => toggleWatch(account.id, cal.id, account.watchCalIds)}
                        className="rounded text-blue-600"
                      />
                      <span className="text-sm text-gray-800">
                        {cal.name}
                        {cal.primary && <span className="ml-1 text-xs text-gray-400">(primary)</span>}
                      </span>
                    </label>
                    <label
                      className={`flex items-center gap-2 text-xs mr-3 ${
                        isMainCal ? "text-gray-300 cursor-not-allowed" : "text-gray-500 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isMirrored}
                        disabled={isMainCal || isMirrorSaving}
                        onChange={() => toggleMirror(account.id, cal.id, account.mirrorCalIds)}
                        className="rounded text-blue-600"
                      />
                      Mirror to Main
                    </label>
                    <button
                      onClick={() => setMain(account.id, cal.id)}
                      disabled={isMainCal || !!isSaving}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        isMainCal
                          ? "bg-blue-100 text-blue-700 cursor-default"
                          : "text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                      }`}
                    >
                      {isMainCal ? "Receives bookings" : "Use for bookings"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
