"use client";
import { useState } from "react";

export default function CancelButton({ bookingId }: { bookingId: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function cancel() {
    setStatus("loading");
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    setStatus(res.ok ? "done" : "error");
  }

  if (status === "done") {
    return <p className="text-green-600 font-medium">Your booking has been cancelled.</p>;
  }
  if (status === "error") {
    return <p className="text-red-600">Something went wrong. Please try again.</p>;
  }

  return (
    <button
      onClick={cancel}
      disabled={status === "loading"}
      className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
    >
      {status === "loading" ? "Cancelling…" : "Yes, cancel this booking"}
    </button>
  );
}
