# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- Deploys no longer cause brief 500s (`ChunkLoadError`, missing client reference manifest) while the live server reads a `.next/` directory that's mid-overwrite by the new build — builds now go into an alternate directory and get swapped in atomically via symlink right before `pm2 restart`

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
