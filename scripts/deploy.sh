#!/bin/bash
set -e
cd /var/www/calsync
# reset --hard (not pull) because npm on this box rewrites package-lock.json
# in place on every build (strips a `libc` field its version doesn't emit),
# which otherwise blocks the next pull with local-changes-would-be-overwritten
git fetch origin
git reset --hard origin/main
cp prisma/prod.db "prisma/prod.db.bak-$(date +%Y%m%d%H%M%S)"
npm install
npx prisma generate
npx prisma migrate deploy

# Build into whichever of .next-a/.next-b isn't currently live, then swap
# it in with an atomic symlink rename. This avoids the live pm2 process
# reading a half-overwritten .next/ mid-request during the build.
if [ "$(readlink .next 2>/dev/null)" = ".next-b" ]; then
  TARGET=.next-a
else
  TARGET=.next-b
fi
rm -rf "$TARGET"
NEXT_DIST_DIR="$TARGET" NODE_OPTIONS="--max-old-space-size=2048" npm run build
[ -d .next ] && [ ! -L .next ] && rm -rf .next  # one-time migration off the old plain-directory build
ln -sfn "$TARGET" .next

pm2 restart calsync
