CREATE TABLE "BookCover" (
  "bookId" UUID PRIMARY KEY REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "bytes" BYTEA NOT NULL CHECK (octet_length("bytes") BETWEEN 1 AND 153600),
  "mime" TEXT NOT NULL CHECK ("mime" IN ('image/jpeg', 'image/png', 'image/webp'))
);

ALTER TABLE "Reading"
  ADD COLUMN "started" TEXT,
  ADD COLUMN "currentPage" INTEGER,
  ADD COLUMN "totalPages" INTEGER,
  ADD COLUMN "progressPercent" DOUBLE PRECISION,
  ADD CONSTRAINT "Reading_progresso_valido" CHECK (
    ("currentPage" IS NULL OR "currentPage" >= 0)
    AND ("totalPages" IS NULL OR "totalPages" > 0)
    AND ("currentPage" IS NULL OR "totalPages" IS NULL OR "currentPage" <= "totalPages")
    AND ("progressPercent" IS NULL OR "progressPercent" BETWEEN 0 AND 100)
  );
