#!/bin/bash
set -e
cd /var/www/calsync
git pull
cp prisma/prod.db "prisma/prod.db.bak-$(date +%Y%m%d%H%M%S)"
npx prisma generate
npx prisma migrate deploy
NODE_OPTIONS="--max-old-space-size=2048" npm run build
pm2 restart calsync
