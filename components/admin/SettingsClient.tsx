"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

type WorkingDay = { enabled: boolean; start: string; end: string };
type WorkingHours = Record<string, WorkingDay>;

interface Props {
  initial: {
    name: string | null;
    email: string;
    slug: string;
    timezone: string;
    bufferMinutes: number;
    workingHours: WorkingHours;
    zoomConnected: boolean;
    zoomStatus?: string;
  };
}

export default function SettingsClient({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const zoomConnected = initial.zoomConnected;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setDay(key: string, field: keyof WorkingDay, value: unknown) {
    setForm((f) => ({
      ...f,
      workingHours: {
        ...f.workingHours,
        [key]: { ...f.workingHours[key], [field]: value },
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  const timeOptions: { val: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const label = new Date(`2000-01-01T${val}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      timeOptions.push({ val, label });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Booking URL slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buffer between meetings</label>
            <select
              value={form.bufferMinutes}
              onChange={(e) => setForm((f) => ({ ...f, bufferMinutes: Number(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[0, 5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>{m === 0 ? "None" : `${m} minutes`}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Working Hours</h2>
        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const day = form.workingHours[key] ?? { enabled: false, start: "09:00", end: "17:00" };
            return (
              <div key={key} className="flex items-center gap-4">
                <label className="flex items-center gap-2 w-36">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => setDay(key, "enabled", e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
                {day.enabled && (
                  <div className="flex items-center gap-2">
                    <select
                      value={day.start}
                      onChange={(e) => setDay(key, "start", e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {timeOptions.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                    <span className="text-gray-400 text-sm">–</span>
                    <select
                      value={day.end}
                      onChange={(e) => setDay(key, "end", e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {timeOptions.map((t) => <option key={t.val} value={t.val}>{t.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-gray-900">Integrations</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
              <rect width="24" height="24" rx="6" fill="#2D8CFF"/>
              <path d="M14.5 8.5C14.5 7.12 13.38 6 12 6s-2.5 1.12-2.5 2.5S10.62 11 12 11s2.5-1.12 2.5-2.5zm-7 0C7.5 7.12 6.38 6 5 6S2.5 7.12 2.5 8.5 3.62 11 5 11s2.5-1.12 2.5-2.5zm14 0C21.5 7.12 20.38 6 19 6s-2.5 1.12-2.5 2.5S17.62 11 19 11s2.5-1.12 2.5-2.5zM12 12.5c-2.33 0-7 1.17-7 3.5V18h14v-2c0-2.33-4.67-3.5-7-3.5z" fill="white"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">Zoom</p>
              <p className="text-xs text-gray-500">
                {zoomConnected ? "Connected — meeting links created automatically" : "Connect to generate Zoom links for bookings"}
              </p>
              {initial.zoomStatus === "error" && (
                <p className="text-xs text-red-500 mt-0.5">Connection failed. Please try again.</p>
              )}
              {initial.zoomStatus === "connected" && (
                <p className="text-xs text-green-600 mt-0.5">Successfully connected!</p>
              )}
            </div>
          </div>
          {zoomConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Connected
            </span>
          ) : (
            <a
              href="/api/integrations/zoom/connect"
              className="px-4 py-1.5 bg-[#2D8CFF] text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              Connect Zoom
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </form>
  );
}
