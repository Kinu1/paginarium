import type { Prisma, PersonalChallenge } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

export async function clearChallengeBook(tx: Tx, owner: string, id: string) {
  const rows = await tx.$queryRaw<PersonalChallenge[]>`
    SELECT * FROM "PersonalChallenge" WHERE owner = ${owner}
      AND EXISTS (SELECT 1 FROM jsonb_each_text(progress) AS field WHERE field.value = ${id})
    ORDER BY id FOR UPDATE
  `;
  for (const row of rows) {
    const progress = Object.fromEntries(
      Object.entries(row.progress as Record<string, string>).filter(
        ([, value]) => value !== id,
      ),
    );
    await tx.personalChallenge.update({
      where: { id: row.id },
      data: { progress, revision: { increment: 1 } },
    });
  }
}
