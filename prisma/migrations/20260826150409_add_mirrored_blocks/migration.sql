-- CreateTable
CREATE TABLE "MirroredBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "sourceCalId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceUpdatedAt" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "mainAccountId" TEXT NOT NULL,
    "mainEventId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MirroredBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MirroredBlock_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "CalendarAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MirroredBlock_mainAccountId_fkey" FOREIGN KEY ("mainAccountId") REFERENCES "CalendarAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "mainCalId" TEXT,
    "watchCalIds" TEXT NOT NULL DEFAULT '[]',
    "mirrorCalIds" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CalendarAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CalendarAccount" ("accessToken", "accountEmail", "createdAt", "expiresAt", "id", "isMain", "mainCalId", "provider", "refreshToken", "userId", "watchCalIds") SELECT "accessToken", "accountEmail", "createdAt", "expiresAt", "id", "isMain", "mainCalId", "provider", "refreshToken", "userId", "watchCalIds" FROM "CalendarAccount";
DROP TABLE "CalendarAccount";
ALTER TABLE "new_CalendarAccount" RENAME TO "CalendarAccount";
CREATE UNIQUE INDEX "CalendarAccount_userId_accountEmail_provider_key" ON "CalendarAccount"("userId", "accountEmail", "provider");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MirroredBlock_sourceAccountId_sourceCalId_sourceEventId_key" ON "MirroredBlock"("sourceAccountId", "sourceCalId", "sourceEventId");
