# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Changelog is in CHANGELOG.md.

## Commands

```bash
npm run dev          # Start dev server (localhost:3002)
npm run build        # Production build
npx tsc --noEmit     # Type-check without building
npx prisma migrate dev --name <name>   # Create and apply a migration
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Browse the database
```

## Architecture

**CalSync** is a multi-tenant calendar booking SaaS. Each user connects multiple Google/Outlook accounts, configures which calendars to block, designates one calendar to receive new bookings, and gets a public URL (`/book/[slug]`) where others can book time.

### Key data flow

1. **Booking request** → `GET /api/availability` queries free/busy live from all connected calendar accounts, merges intervals, subtracts from working hours, returns open slots.
2. **Booking confirmation** → `POST /api/bookings` re-validates the slot, creates a calendar event on the main account, stores the booking in SQLite, sends an email with an ICS attachment.
3. **OAuth for calendars** is separate from app auth. Google and Microsoft OAuth callbacks (`/api/calendars/google/callback`, `/api/calendars/microsoft/callback`) store tokens in `CalendarAccount`. App login uses NextAuth credentials (email + bcrypt password).

### Directory map

- `lib/` — shared server logic: `google-calendar.ts`, `microsoft-calendar.ts` (API wrappers + token refresh), `availability.ts` (the core slot-generation engine), `email.ts` (nodemailer + ical-generator), `auth.ts` (NextAuth config), `prisma.ts` (singleton client)
- `app/api/` — API routes: `auth/`, `calendars/`, `availability/`, `bookings/`, `meeting-types/`, `settings/`, `register/`
- `app/dashboard/` — admin pages (server components, each imports a `*Client.tsx` for interactivity)
- `app/book/[slug]/` — public booking flow: index (pick meeting type) → `[type]` (pick date/slot/fill form) → `cancel/[id]` (cancellation)
- `components/admin/` — `CalendarsClient`, `MeetingTypesClient`, `SettingsClient`
- `components/booking/` — `BookingClient` (multi-step date → slot → form → confirmed)
- `prisma/schema.prisma` — four models: `User`, `CalendarAccount`, `MeetingType`, `Booking`

### Prisma 7 notes

- Schema has **no `url` field** in `datasource` — connection URL lives only in `prisma.config.ts` (for migrations) and the `PrismaLibSql` adapter in `lib/prisma.ts` (for runtime queries).
- SQLite is accessed via `@prisma/adapter-libsql` + `PrismaLibSql({ url })`.

### Environment variables

All required vars are in `.env`. Before running, fill in:
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console; redirect URI: `<base>/api/calendars/google/callback`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` — from Azure portal; redirect URI: `<base>/api/calendars/microsoft/callback`
- `SMTP_*` — any SMTP relay (Gmail app password works)
- `NEXT_PUBLIC_BASE_URL` / `NEXTAUTH_URL` — set to production domain when deploying

### Deployment

Push to `main` auto-deploys to production via `.github/workflows/deploy.yml` (SSH into misterd-vps, runs `scripts/deploy.sh`: git pull, backs up `prisma/prod.db`, prisma generate/migrate, build, `pm2 restart calsync`). No manual deploy needed for normal changes.

### Changelog

Keep `CHANGELOG.md` current as you go — don't wait to be asked. Whenever you land a user-facing change (a fix, a new feature, a behavior change), add an entry under `## [Unreleased]` in the same commit, following [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format (`### Added` / `### Changed` / `### Fixed`). Roll `[Unreleased]` into a dated version heading (e.g. `## [0.3.0] - 2026-09-01`) when a batch of related changes ships together — use judgment on version bumps (this project doesn't tag releases). Skip internal-only changes (refactors, deploy tooling tweaks, memory/doc updates) unless they materially affect how the app behaves or is run.
