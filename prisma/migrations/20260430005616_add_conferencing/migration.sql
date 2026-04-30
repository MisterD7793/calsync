-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "conferenceLink" TEXT;

-- RedefineTables
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
    "locationType" TEXT NOT NULL DEFAULT 'none',
    "locationValue" TEXT,
    "conferenceLink" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MeetingType" ("color", "createdAt", "description", "durationMinutes", "id", "isActive", "name", "slug", "userId") SELECT "color", "createdAt", "description", "durationMinutes", "id", "isActive", "name", "slug", "userId" FROM "MeetingType";
DROP TABLE "MeetingType";
ALTER TABLE "new_MeetingType" RENAME TO "MeetingType";
CREATE UNIQUE INDEX "MeetingType_userId_slug_key" ON "MeetingType"("userId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
