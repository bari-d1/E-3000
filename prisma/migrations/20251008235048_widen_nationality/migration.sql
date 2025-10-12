/*
  Warnings:

  - You are about to drop the column `editableUntil` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `signature` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `suspicious` on the `Session` table. All the data in the column will be lost.
  - You are about to drop the column `underReview` on the `Session` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionDate" DATETIME NOT NULL,
    "locationText" TEXT,
    "engagedCount" INTEGER NOT NULL,
    "gospelCount" INTEGER NOT NULL,
    "witnessCount" INTEGER NOT NULL,
    "decisionCount" INTEGER NOT NULL,
    "prayedCount" INTEGER NOT NULL,
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "decisionCount", "engagedCount", "gospelCount", "id", "locationText", "notes", "prayedCount", "sessionDate", "updatedAt", "userId", "witnessCount") SELECT "createdAt", "decisionCount", "engagedCount", "gospelCount", "id", "locationText", "notes", "prayedCount", "sessionDate", "updatedAt", "userId", "witnessCount" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
