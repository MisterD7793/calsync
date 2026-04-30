import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/availability";
import * as Google from "@/lib/google-calendar";
import * as Microsoft from "@/lib/microsoft-calendar";
import * as Zoom from "@/lib/zoom";
import { sendBookingConfirmation } from "@/lib/email";
import { auth } from "@/lib/auth";

const BookingSchema = z.object({
  slug: z.string(),
  meetingTypeId: z.string(),
  start: z.string().datetime(),
  bookerName: z.string().min(1),
  bookerEmail: z.string().email(),
  notes: z.string().optional(),
  selectedLocationType: z.string().nullable().optional(),
  selectedLocationValue: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { slug, meetingTypeId, start, bookerName, bookerEmail, notes, selectedLocationType, selectedLocationValue } = parsed.data;

  const user = await prisma.user.findUnique({ where: { slug } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meetingType = await prisma.meetingType.findFirst({
    where: { id: meetingTypeId, userId: user.id, isActive: true },
  });
  if (!meetingType) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const startDate = new Date(start);
  const endDate = new Date(startDate.getTime() + meetingType.durationMinutes * 60 * 1000);
  const dateStr = start.slice(0, 10);

  // Verify the slot is still available
  const available = await getAvailableSlots(user.id, meetingType.durationMinutes, dateStr);
  const isAvailable = available.some((s) => new Date(s.start).getTime() === startDate.getTime());
  if (!isAvailable) {
    return NextResponse.json({ error: "Slot no longer available" }, { status: 409 });
  }

  // Find the main calendar account
  const mainAccount = await prisma.calendarAccount.findFirst({
    where: { userId: user.id, isMain: true },
  });

  // Use the booker's selected location option
  const locationType = selectedLocationType ?? "none";
  const locationValue = selectedLocationValue ?? null;
  const isPhone = locationType === "phone";
  const isCustom = locationType === "custom";

  let eventLocation: string | undefined;
  if (isPhone && locationValue) eventLocation = `Phone: ${locationValue}`;
  else if (isCustom && locationValue) eventLocation = locationValue;

  const eventDescription = notes ? `Notes from ${bookerName}: ${notes}` : undefined;
  const eventTitle = `${meetingType.name} with ${bookerName}`;

  // Create calendar event
  let calendarEventId: string | null = null;
  let conferenceLink: string | null = (isPhone || isCustom) && locationValue ? locationValue : null;

  // Create Zoom meeting before calendar event so the link can be embedded
  if (locationType === "zoom") {
    try {
      const { joinUrl } = await Zoom.createMeeting(user.id, {
        topic: eventTitle,
        startTime: startDate,
        durationMinutes: meetingType.durationMinutes,
      });
      conferenceLink = joinUrl;
      eventLocation = joinUrl;
    } catch (e) {
      console.error("Failed to create Zoom meeting:", e);
    }
  }

  if (mainAccount?.mainCalId) {
    try {
      if (mainAccount.provider === "google") {
        const result = await Google.createEvent(mainAccount, mainAccount.mainCalId, {
          title: eventTitle,
          start: startDate,
          end: endDate,
          bookerName,
          bookerEmail,
          description: eventDescription,
          location: eventLocation,
          addMeet: locationType === "google_meet",
        });
        calendarEventId = result.eventId;
        if (result.conferenceLink) conferenceLink = result.conferenceLink;
      } else {
        const result = await Microsoft.createEvent(mainAccount, mainAccount.mainCalId, {
          title: eventTitle,
          start: startDate,
          end: endDate,
          bookerName,
          bookerEmail,
          description: eventDescription,
          location: eventLocation,
          addTeams: locationType === "teams",
        });
        calendarEventId = result.eventId;
        if (result.conferenceLink) conferenceLink = result.conferenceLink;
      }
    } catch (e) {
      console.error("Failed to create calendar event:", e);
    }
  }

  const booking = await prisma.booking.create({
    data: {
      meetingTypeId,
      userId: user.id,
      calendarAccountId: mainAccount?.id ?? null,
      bookerName,
      bookerEmail,
      notes,
      startTime: startDate,
      endTime: endDate,
      calendarEventId,
      conferenceLink,
    },
  });

  // Send confirmation email
  try {
    await sendBookingConfirmation({
      bookingId: booking.id,
      meetingTypeName: meetingType.name,
      start: startDate,
      end: endDate,
      timezone: user.timezone,
      organizerName: user.name ?? user.email,
      organizerEmail: user.email,
      bookerName,
      bookerEmail,
      conferenceLink,
      locationType,
      cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/book/${slug}/cancel/${booking.id}`,
    });
  } catch (e) {
    console.error("Failed to send confirmation email:", e);
  }

  return NextResponse.json({ bookingId: booking.id });
}

// GET /api/bookings — admin: list own bookings
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookings = await prisma.booking.findMany({
    where: { userId: session.user.id },
    include: { meetingType: true },
    orderBy: { startTime: "desc" },
  });
  return NextResponse.json(bookings);
}
