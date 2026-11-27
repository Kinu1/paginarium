import type { Prisma, Competition } from "../generated/prisma/client.js";
import { invalidate } from "./bracket.js";

type Tx = Prisma.TransactionClient;

export async function clearCompetitionBook(tx: Tx, owner: string, id: string) {
  const rows = await tx.$queryRaw<Competition[]>`
    SELECT * FROM "Competition" WHERE owner = ${owner} AND slots @> ${JSON.stringify([id])}::jsonb
    ORDER BY id FOR UPDATE
  `;
  for (const row of rows) {
    const slots = row.slots as (string | null)[];
    const votes = row.votes as Record<string, string>;
    const slot = slots.indexOf(id);
    if (slot === -1) continue;
    slots[slot] = null;
    await tx.competition.update({
      where: { id: row.id },
      data: {
        slots,
        votes: invalidate(slot, votes),
        revision: { increment: 1 },
      },
    });
  }
}
