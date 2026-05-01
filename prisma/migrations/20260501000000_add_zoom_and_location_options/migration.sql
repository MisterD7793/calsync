-- Add Zoom token fields to User
ALTER TABLE "User" ADD COLUMN "zoomAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "zoomRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "zoomTokenExpiresAt" DATETIME;

-- Replace locationType/locationValue/conferenceLink on MeetingType with locationOptions JSON column
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MeetingType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT NOT NULL DEFAULT '#3B82F6',
    "locationOptions" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MeetingType" ("color", "createdAt", "description", "durationMinutes", "id", "isActive", "name", "slug", "userId")
    SELECT "color", "createdAt", "description", "durationMinutes", "id", "isActive", "name", "slug", "userId" FROM "MeetingType";
DROP TABLE "MeetingType";
ALTER TABLE "new_MeetingType" RENAME TO "MeetingType";
CREATE UNIQUE INDEX "MeetingType_userId_slug_key" ON "MeetingType"("userId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
