#!/bin/bash
set -e
cd /var/www/calsync

cp prisma/prod.db "prisma/prod.db.bak-$(date +%Y%m%d%H%M%S)"
npm ci --omit=dev
npx prisma generate
npx prisma migrate deploy

# .next-incoming was just rsynced in by CI. Move it into whichever of
# .next-a/.next-b isn't currently live, then swap the .next symlink
# in atomically. The live pm2 process never sees a half-written .next/.
if [ "$(readlink .next 2>/dev/null)" = ".next-b" ]; then
  TARGET=.next-a
else
  TARGET=.next-b
fi
rm -rf "$TARGET"
mv .next-incoming "$TARGET"
ln -sfn "$TARGET" .next

sudo /usr/bin/pm2 restart calsync
