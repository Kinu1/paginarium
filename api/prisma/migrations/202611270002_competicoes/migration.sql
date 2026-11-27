CREATE TABLE "Competition" (
  "id" UUID NOT NULL PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "challengeId" UUID,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "slots" JSONB NOT NULL,
  "votes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Competition_challengeId_key" ON "Competition"("challengeId");
CREATE INDEX "Competition_owner_createdAt_idx" ON "Competition"("owner","createdAt");
