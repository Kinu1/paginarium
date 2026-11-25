-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Book" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "workKey" TEXT,
    "editionKey" TEXT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "coverUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'want',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "plannedYears" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "bookId" UUID NOT NULL,
    "id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "days" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finished" TEXT,
    "rating" DOUBLE PRECISION,
    "favorite" BOOLEAN NOT NULL,
    "review" TEXT NOT NULL,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("bookId","id")
);

-- CreateTable
CREATE TABLE "JournalYear" (
    "owner" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "squares" JSONB NOT NULL,
    "letters" JSONB NOT NULL,
    "colors" JSONB NOT NULL,
    "monthly" JSONB NOT NULL,
    "rounds" JSONB NOT NULL,

    CONSTRAINT "JournalYear_pkey" PRIMARY KEY ("owner","year")
);

-- CreateIndex
CREATE INDEX "Book_owner_createdAt_idx" ON "Book"("owner", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Book_owner_identity_key" ON "Book"("owner", "identity");

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
