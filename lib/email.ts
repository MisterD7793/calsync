import nodemailer from "nodemailer";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import ical from "ical-generator";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_PORT === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

function buildIcs(params: {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  organizerName: string;
  organizerEmail: string;
  bookerName: string;
  bookerEmail: string;
  location?: string;
  description?: string;
}): string {
  const cal = ical({ name: "Booking Confirmation" });
  cal.createEvent({
    id: params.uid,
    start: params.start,
    end: params.end,
    summary: params.title,
    description: params.description,
    location: params.location,
    organizer: { name: params.organizerName, email: params.organizerEmail },
    attendees: [{ name: params.bookerName, email: params.bookerEmail, rsvp: true }],
  });
  return cal.toString();
}

function conferenceLabel(locationType: string, link: string | null): string | null {
  if (!link) return null;
  switch (locationType) {
    case "google_meet": return `Google Meet: <a href="${link}">${link}</a>`;
    case "teams":       return `Microsoft Teams: <a href="${link}">${link}</a>`;
    case "zoom":        return `Zoom: <a href="${link}">${link}</a>`;
    case "phone":       return `Phone: ${link}`;
    case "custom":      return `Location: <a href="${link}">${link}</a>`;
    default:            return null;
  }
}

export async function sendBookingConfirmation(params: {
  bookingId: string;
  meetingTypeName: string;
  start: Date;
  end: Date;
  timezone: string;
  organizerName: string;
  organizerEmail: string;
  bookerName: string;
  bookerEmail: string;
  conferenceLink: string | null;
  locationType: string;
  cancelUrl: string;
}) {
  const zonedStart = toZonedTime(params.start, params.timezone);
  const zonedEnd = toZonedTime(params.end, params.timezone);
  const dateStr = format(zonedStart, "EEEE, MMMM d, yyyy");
  const timeStr = `${format(zonedStart, "h:mm a")} – ${format(zonedEnd, "h:mm a")}`;

  const confLabel = conferenceLabel(params.locationType, params.conferenceLink);
  const icsLocation = params.locationType === "phone"
    ? `Phone: ${params.conferenceLink}`
    : params.conferenceLink ?? undefined;

  const icsContent = buildIcs({
    uid: params.bookingId,
    title: `${params.meetingTypeName} with ${params.organizerName}`,
    start: params.start,
    end: params.end,
    organizerName: params.organizerName,
    organizerEmail: params.organizerEmail,
    bookerName: params.bookerName,
    bookerEmail: params.bookerEmail,
    location: icsLocation,
  });

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
      <h2 style="color:#111">Booking Confirmed</h2>
      <p>Hi ${params.bookerName},</p>
      <p>Your <strong>${params.meetingTypeName}</strong> with <strong>${params.organizerName}</strong> is confirmed.</p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0">
        <tr><td style="padding:8px;color:#666;width:80px">Date</td><td style="padding:8px">${dateStr}</td></tr>
        <tr><td style="padding:8px;color:#666">Time</td><td style="padding:8px">${timeStr} (${params.timezone})</td></tr>
        ${confLabel ? `<tr><td style="padding:8px;color:#666">How</td><td style="padding:8px">${confLabel}</td></tr>` : ""}
      </table>
      <p>A calendar invite is attached.</p>
      <p style="margin-top:32px;font-size:13px;color:#999">
        Need to cancel? <a href="${params.cancelUrl}">Cancel this booking</a>
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `"${params.organizerName}" <${process.env.SMTP_FROM}>`,
    to: params.bookerEmail,
    subject: `Confirmed: ${params.meetingTypeName} on ${dateStr}`,
    html,
    icalEvent: { method: "REQUEST", content: icsContent },
  });
}
