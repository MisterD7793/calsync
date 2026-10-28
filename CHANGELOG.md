# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Version History page (`/dashboard/changelog`), linked from the dashboard sidebar footer — renders `CHANGELOG.md`

### Changed
- Deploy pipeline now builds in GitHub Actions (not on the VPS) and ships the result via `rsync`, matching the pattern already used by other self-hosted projects on this box. The VPS only runs `npm ci --omit=dev`, Prisma generate/migrate, and a restart — no more building under the box's RAM constraints
- Deploys now run as a dedicated non-root `deploy` user with a sudoers rule scoped to exactly `pm2 restart calsync`, instead of full root SSH access

### Fixed
- All-day events on watched calendars are now mirrored to Main as all-day events marked Free — they show in the all-day strip without blocking out the whole day, and are mirrored even when marked Free at the source — instead of as a timed 24-hour block that started at midnight UTC (7–8pm the evening before, Eastern). Existing mis-mirrored blocks are recreated correctly on the next sync. On Outlook, all-day blocks are created in the user's time zone so Outlook doesn't show them with "12:00 AM – 12:00 AM" times
- Deploys no longer cause brief 500s (`ChunkLoadError`, missing client reference manifest) while the live server reads a `.next/` directory that's mid-overwrite by the new build — the incoming build now lands in an alternate directory and gets swapped in atomically via symlink right before `pm2 restart`

## [0.2.0] - 2026-08-26

### Added
- Calendar Block Mirroring — watched calendars sync as Busy blocks on the Main calendar
- Auto-deploy — pushes to `main` now trigger a GitHub Actions workflow that SSH-deploys to production (misterd-vps)

### Fixed
- Mirrored blocks now respect event Free/Busy status — events marked Free are no longer mirrored as Busy on Main
- Production start script port corrected (production runs on 3001)

## [0.1.0] - 2026-04-30

### Added
- Initial commit — CalSync booking SaaS
- Migration for Zoom token fields and `locationOptions` column
