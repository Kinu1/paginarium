CREATE TABLE "PersonalChallenge" (
  "id" UUID NOT NULL PRIMARY KEY,
  "owner" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "rules" JSONB NOT NULL,
  "progress" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PersonalChallenge_owner_createdAt_idx" ON "PersonalChallenge"("owner","createdAt");
CREATE INDEX "PersonalChallenge_published_format_createdAt_idx" ON "PersonalChallenge"("published","format","createdAt");
