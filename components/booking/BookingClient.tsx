"use client";
import { useState } from "react";
import { format, addDays, startOfDay, parseISO, addMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { useRouter } from "next/navigation";

interface Props {
  user: { name: string | null; slug: string; timezone: string };
  meetingType: {
    id: string;
    name: string;
    durationMinutes: number;
    description: string | null;
    color: string;
    locationOptions: LocationOption[];
  };
}

interface Slot {
  start: string;
  end: string;
}

interface DaySchedule {
  slots: Slot[];
  busyIntervals: Slot[];
  workingHours: { start: string; end: string } | null;
  timezone: string;
}

type Step = "date" | "slot" | "location" | "form" | "confirmed";
type ViewMode = "timeline" | "grid";

interface LocationOption {
  type: string;
  value: string;
  label: string;
}

function locationIcon(type: string) {
  switch (type) {
    case "google_meet": return "🎥";
    case "teams":       return "💼";
    case "zoom":        return "📹";
    case "phone":       return "📞";
    default:            return "📍";
  }
}

export default function BookingClient({ user, meetingType }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const [calMonth, setCalMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const hasLocationOptions = meetingType.locationOptions.length > 0;

  async function selectDate(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    setSelectedDate(dateStr);
    setLoadingSlots(true);
    setStep("slot");
    const res = await fetch(
      `/api/availability?slug=${user.slug}&typeId=${meetingType.id}&date=${dateStr}`
    );
    const data = await res.json();
    setSchedule(data);
    setLoadingSlots(false);
  }

  function selectSlot(slot: Slot) {
    setSelectedSlot(slot);
    if (hasLocationOptions) {
      setStep("location");
    } else {
      setStep("form");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmitting(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: user.slug,
        meetingTypeId: meetingType.id,
        start: selectedSlot.start,
        bookerName: form.name,
        bookerEmail: form.email,
        notes: form.notes,
        selectedLocationType: selectedLocation?.type ?? null,
        selectedLocationValue: selectedLocation?.value ?? null,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setBookingId(data.bookingId);
      setStep("confirmed");
    } else {
      alert(data.error ?? "Something went wrong");
    }
  }

  function formatSlotTime(iso: string) {
    const zoned = toZonedTime(new Date(iso), user.timezone);
    return format(zoned, "h:mm a");
  }

  const header = (
    <div className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4 mb-6">
      <div className="w-3 h-12 rounded-full flex-shrink-0" style={{ background: meetingType.color }} />
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide">{user.name ?? user.slug}</p>
        <p className="font-semibold text-gray-900 text-lg">{meetingType.name}</p>
        <p className="text-sm text-gray-500">
          {meetingType.durationMinutes} min
          {meetingType.description && ` · ${meetingType.description}`}
          {meetingType.locationOptions.length > 0 && ` · ${meetingType.locationOptions.map(o => o.label).join(", ")}`}
        </p>
      </div>
    </div>
  );

  if (step === "confirmed" && bookingId) {
    return (
      <div>
        {header}
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Booking confirmed!</h2>
          {selectedSlot && (
            <p className="text-gray-600">
              {format(toZonedTime(new Date(selectedSlot.start), user.timezone), "EEEE, MMMM d")} at{" "}
              {formatSlotTime(selectedSlot.start)}
            </p>
          )}
          <p className="text-sm text-gray-500">
            A confirmation email with a calendar invite has been sent to <strong>{form.email}</strong>.
          </p>
          <button
            onClick={() => { setStep("date"); setSelectedDate(null); setSelectedSlot(null); setForm({ name: "", email: "", notes: "" }); }}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            Book another time
          </button>
        </div>
      </div>
    );
  }

  if (step === "location" && selectedSlot) {
    return (
      <div>
        {header}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <button onClick={() => setStep("slot")} className="text-sm text-blue-600 hover:underline">
              ← {selectedDate && format(parseISO(selectedDate), "MMMM d")} at {formatSlotTime(selectedSlot.start)}
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="font-medium text-gray-900">How would you like to meet?</p>
            {meetingType.locationOptions.map((opt, i) => (
              <button
                key={i}
                onClick={() => { setSelectedLocation(opt); setStep("form"); }}
                className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors text-left group"
              >
                <span className="text-2xl">{locationIcon(opt.type)}</span>
                <div>
                  <p className="font-medium text-gray-900 group-hover:text-blue-700">{opt.label}</p>
                  {opt.value && (
                    <p className="text-sm text-gray-400">{opt.value}</p>
                  )}
                  {(opt.type === "google_meet" || opt.type === "teams") && (
                    <p className="text-sm text-gray-400">Link generated at confirmation</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === "form" && selectedSlot) {
    return (
      <div>
        {header}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800 space-y-1">
            <div>
              {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d")} at{" "}
              {formatSlotTime(selectedSlot.start)} ({user.timezone})
              <button onClick={() => setStep("slot")} className="ml-3 underline text-blue-600">Change</button>
            </div>
            {selectedLocation && (
              <div className="flex items-center gap-1.5">
                <span>{locationIcon(selectedLocation.type)}</span>
                <span>{selectedLocation.label}</span>
                <button onClick={() => setStep("location")} className="ml-2 underline text-blue-600">Change</button>
              </div>
            )}
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Confirming…" : "Confirm booking"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "slot") {
    const wh = schedule?.workingHours;
    const availableSet = new Set((schedule?.slots ?? []).map((s) => s.start));

    // Build every 30-min row across the working day
    const rows: { time: Date; iso: string }[] = [];
    if (wh) {
      let cursor = new Date(wh.start);
      const end = new Date(wh.end);
      while (cursor < end) {
        rows.push({ time: new Date(cursor), iso: cursor.toISOString() });
        cursor = new Date(cursor.getTime() + 30 * 60 * 1000);
      }
    }

    // Check if a 30-min block overlaps with any busy interval
    function isBusy(iso: string) {
      const s = new Date(iso).getTime();
      const e = s + 30 * 60 * 1000;
      return (schedule?.busyIntervals ?? []).some(
        (b) => new Date(b.start).getTime() < e && new Date(b.end).getTime() > s
      );
    }

    return (
      <div>
        {header}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button onClick={() => setStep("date")} className="text-sm text-blue-600 hover:underline">
              ← {selectedDate && format(parseISO(selectedDate), "EEEE, MMMM d")}
            </button>
            <div className="flex items-center gap-3">
              {schedule && <span className="text-xs text-gray-400">{schedule.timezone}</span>}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`px-3 py-1.5 transition-colors ${viewMode === "timeline" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  Timeline
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 transition-colors ${viewMode === "grid" ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                >
                  Grid
                </button>
              </div>
            </div>
          </div>

          {loadingSlots ? (
            <div className="py-12 text-center text-gray-400">Loading…</div>
          ) : !wh || rows.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              No availability on this day.{" "}
              <button onClick={() => setStep("date")} className="text-blue-600 hover:underline">
                Pick another date
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="p-5">
              {availableSet.size === 0 ? (
                <p className="text-center text-gray-400 py-8">
                  No open slots on this day.{" "}
                  <button onClick={() => setStep("date")} className="text-blue-600 hover:underline">Pick another date</button>
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(schedule?.slots ?? []).map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => selectSlot(slot)}
                      className="py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      {formatSlotTime(slot.start)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[480px]">
              {rows.map(({ time, iso }) => {
                const busy = isBusy(iso);
                const available = availableSet.has(iso);
                const showHour = time.getMinutes() === 0;

                return (
                  <div
                    key={iso}
                    className={`flex items-stretch border-b border-gray-50 last:border-0 ${
                      busy ? "bg-gray-50" : ""
                    }`}
                  >
                    {/* Time label */}
                    <div className="w-16 flex-shrink-0 flex items-center justify-end pr-3 py-2">
                      {showHour && (
                        <span className="text-xs font-medium text-gray-400">
                          {format(time, "h a")}
                        </span>
                      )}
                    </div>

                    {/* Slot content */}
                    <div className="flex-1 py-1 pr-3">
                      {available ? (
                        <button
                          onClick={() => {
                            const slot = (schedule?.slots ?? []).find((s) => s.start === iso)!;
                            selectSlot(slot);
                          }}
                          className="w-full text-left px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:border-blue-400 transition-colors"
                        >
                          {formatSlotTime(iso)} — {formatSlotTime(
                            new Date(new Date(iso).getTime() + meetingType.durationMinutes * 60 * 1000).toISOString()
                          )}
                        </button>
                      ) : busy ? (
                        <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-400 select-none">
                          Busy
                        </div>
                      ) : (
                        <div className="h-6" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Date picker (step === "date")
  const maxDate = addDays(today, 60);

  const monthStart = calMonth;
  const monthEnd = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
  const startPad = monthStart.getDay();
  const calDays: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: monthEnd.getDate() }, (_, i) => new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1)),
  ];

  const canGoPrev = calMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1) <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div>
      {header}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
            disabled={!canGoPrev}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
          >
            ‹
          </button>
          <h2 className="font-semibold text-gray-900">{format(calMonth, "MMMM yyyy")}</h2>
          <button
            onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
            disabled={!canGoNext}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
          ))}
          {calDays.map((date, i) => {
            if (!date) return <div key={`pad-${i}`} />;
            const isPast = date <= today;
            const isBeyond = date > maxDate;
            const disabled = isPast || isBeyond;
            return (
              <button
                key={date.toISOString()}
                onClick={() => !disabled && selectDate(date)}
                disabled={disabled}
                className={`h-9 w-full flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                  ${disabled
                    ? "text-gray-300 cursor-default"
                    : "text-gray-700 hover:bg-blue-600 hover:text-white cursor-pointer"
                  }`}
              >
                {format(date, "d")}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-400 text-center">Times shown in {user.timezone}</p>
      </div>
    </div>
  );
}
