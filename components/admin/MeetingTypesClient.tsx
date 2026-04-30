"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MeetingType } from "@prisma/client";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function MeetingTypeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<MeetingType>;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  type LocationOption = { type: string; value: string; label: string };

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    durationMinutes: initial?.durationMinutes ?? 30,
    description: initial?.description ?? "",
    color: initial?.color ?? "#3B82F6",
    isActive: initial?.isActive ?? true,
    locationOptions: JSON.parse((initial?.locationOptions as string | undefined) ?? "[]") as LocationOption[],
  });
  const [saving, setSaving] = useState(false);

  function set(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "name" && !initial?.slug) {
      setForm((f) => ({ ...f, slug: slugify(String(value)) }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-xl p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            required
            pattern="[a-z0-9-]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
        <select
          value={form.durationMinutes}
          onChange={(e) => set("durationMinutes", Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[30, 60, 90, 120].map((m) => (
            <option key={m} value={m}>{m} minutes</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
        <textarea
          value={form.description ?? ""}
          onChange={(e) => set("description", e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set("color", c)}
              style={{ background: c }}
              className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Conferencing / Location Options</label>
        <div className="space-y-2">
          {form.locationOptions.map((opt, i) => {
            const usedTypes = new Set(form.locationOptions.filter((_, j) => j !== i).map((o) => o.type));
            const allTypes = [
              { value: "google_meet", label: "Google Meet" },
              { value: "teams", label: "Microsoft Teams" },
              { value: "zoom", label: "Zoom" },
              { value: "phone", label: "Phone" },
              { value: "custom", label: "Custom" },
            ];
            const availableTypes = allTypes.filter((t) => !usedTypes.has(t.value));
            return (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1">
                <div className="flex gap-2">
                  <select
                    value={opt.type}
                    onChange={(e) => {
                      const next = [...form.locationOptions];
                      const defaultLabels: Record<string, string> = {
                        google_meet: "Google Meet", teams: "Microsoft Teams",
                        zoom: "Zoom", phone: "Phone", custom: "Custom",
                      };
                      next[i] = { ...next[i], type: e.target.value, label: defaultLabels[e.target.value] ?? next[i].label };
                      setForm((f) => ({ ...f, locationOptions: next }));
                    }}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={opt.label}
                    onChange={(e) => {
                      const next = [...form.locationOptions];
                      next[i] = { ...next[i], label: e.target.value };
                      setForm((f) => ({ ...f, locationOptions: next }));
                    }}
                    placeholder="Label shown to booker"
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(opt.type === "phone" || opt.type === "zoom" || opt.type === "custom") && (
                  <input
                    type="text"
                    value={opt.value}
                    onChange={(e) => {
                      const next = [...form.locationOptions];
                      next[i] = { ...next[i], value: e.target.value };
                      setForm((f) => ({ ...f, locationOptions: next }));
                    }}
                    placeholder={opt.type === "phone" ? "+1 (555) 000-0000" : opt.type === "zoom" ? "https://zoom.us/j/..." : "Address or URL"}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, locationOptions: f.locationOptions.filter((_, j) => j !== i) }))}
                className="mt-1 text-gray-400 hover:text-red-500 text-lg leading-none"
              >×</button>
            </div>
            );
          })}
          {(() => {
            const allTypes = ["google_meet", "teams", "zoom", "phone", "custom"];
            const usedTypes = new Set(form.locationOptions.map((o) => o.type));
            const defaultLabels: Record<string, string> = {
              google_meet: "Google Meet", teams: "Microsoft Teams",
              zoom: "Zoom", phone: "Phone", custom: "Custom",
            };
            const nextType = allTypes.find((t) => !usedTypes.has(t));
            if (!nextType) return null;
            return (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, locationOptions: [...f.locationOptions, { type: nextType, value: "", label: defaultLabels[nextType] }] }))}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add option
              </button>
            );
          })()}
        </div>
        {form.locationOptions.length === 0 && (
          <p className="text-xs text-gray-400 mt-1">No options — booker won&apos;t be asked how they want to meet.</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="active"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
          className="rounded text-blue-600"
        />
        <label htmlFor="active" className="text-sm text-gray-700">Active (visible on booking page)</label>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function MeetingTypesClient({ types }: { types: MeetingType[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  async function create(data: Record<string, unknown>) {
    await fetch("/api/meeting-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setShowNew(false);
    router.refresh();
  }

  async function update(id: string, data: Record<string, unknown>) {
    await fetch("/api/meeting-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this meeting type?")) return;
    await fetch(`/api/meeting-types?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {types.map((type) =>
        editing === type.id ? (
          <MeetingTypeForm
            key={type.id}
            initial={type}
            onSave={(data) => update(type.id, data)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={type.id} className="bg-white border border-gray-200 rounded-xl p-5 flex items-center gap-4">
            <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ background: type.color }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-gray-900">{type.name}</p>
                {!type.isActive && (
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded">Inactive</span>
                )}
              </div>
              <p className="text-sm text-gray-500">{type.durationMinutes} min · /book/…/{type.slug}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(type.id)} className="text-sm text-gray-500 hover:text-gray-900">
                Edit
              </button>
              <button onClick={() => remove(type.id)} className="text-sm text-red-500 hover:text-red-700">
                Delete
              </button>
            </div>
          </div>
        )
      )}

      {showNew ? (
        <MeetingTypeForm onSave={create} onCancel={() => setShowNew(false)} />
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
        >
          + Add meeting type
        </button>
      )}
    </div>
  );
}
