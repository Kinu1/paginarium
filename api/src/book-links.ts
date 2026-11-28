import { Prisma } from "./generated/prisma/client.js";
import { NotFoundException } from "@nestjs/common";
import { clearCompetitionBook } from "./competition/book-link.js";

type Transaction = Prisma.TransactionClient;
const groups = ["squares", "letters", "colors", "monthly", "rounds"] as const;

// A referência existe enquanto o livro estiver bloqueado, inclusive em uma criação simultânea de vínculo.
export async function lockOwnedBooks(
  tx: Transaction,
  owner: string,
  ids: string[],
) {
  if (!ids.length) return;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Book" WHERE owner = ${owner} AND id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
    ORDER BY id FOR SHARE`;
  if (rows.length !== ids.length)
    throw new NotFoundException("O livro selecionado não está nesta estante.");
}

export async function clearBookLinks(
  tx: Transaction,
  owner: string,
  bookId: string,
) {
  // Bloqueia somente diários que referenciam o livro; jsonb_path_exists compara os valores dos cinco mapas.
  const affected = await tx.$queryRaw<{ year: number }[]>`
    SELECT year FROM "JournalYear"
    WHERE owner = ${owner}
      AND jsonb_path_exists(jsonb_build_array(squares, letters, colors, monthly, rounds),
        '$[*].* ? (@ == $book)', jsonb_build_object('book', ${bookId}::text))
    ORDER BY year FOR UPDATE`;
  for (const { year } of affected) {
    const current = await tx.journalYear.findUniqueOrThrow({
      where: { owner_year: { owner, year } },
    });
    const clean: Record<string, Record<string, string>> = {};
    for (const group of groups) {
      const entries = Object.entries(current[group] as Record<string, string>);
      if (entries.some(([, id]) => id === bookId))
        clean[group] = Object.fromEntries(
          entries.filter(([, id]) => id !== bookId),
        );
    }
    if (Object.keys(clean).length)
      await tx.journalYear.update({
        where: { owner_year: { owner, year } },
        data: { ...clean, revision: { increment: 1 } },
      });
  }
  await clearCompetitionBook(tx, owner, bookId);
}
