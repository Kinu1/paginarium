import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Competition } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { Database } from "../database.js";
import { lockOwnedBooks } from "../book-links.js";
import { draw, matches, vote } from "./bracket.js";

type Tx = Prisma.TransactionClient;
const missing = () => new NotFoundException("Competição não encontrada.");
const stale = () =>
  new ConflictException(
    "A competição mudou em outro acesso. Atualize para continuar.",
  );

function present(row: Competition) {
  const slots = row.slots as (string | null)[];
  const votes = row.votes as Record<string, string>;
  return {
    id: row.id,
    name: row.name,
    challengeId: row.challengeId,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    slots,
    votes,
    matches: matches(slots, votes),
  };
}
async function locked(tx: Tx, owner: string, id: string, revision: number) {
  const rows = await tx.$queryRaw<Competition[]>`
    SELECT * FROM "Competition" WHERE id = ${id}::uuid AND owner = ${owner} FOR UPDATE
  `;
  if (!rows.length) throw missing();
  if (rows[0].revision !== revision) throw stale();
  return present(rows[0]);
}

/** O chamador já reteve as linhas dos 22 livros; reutilizado na instância de um desafio pessoal. */
export async function insertCompetition(
  tx: Tx,
  owner: string,
  name: string,
  ids: string[],
  challengeId: string | null,
) {
  const slots = draw(ids);
  return present(
    await tx.competition.create({
      data: { owner, name, slots, votes: {}, challengeId },
    }),
  );
}

@Injectable()
export class CompetitionService {
  constructor(private readonly db: Database) {}

  async list(owner: string) {
    const rows = await this.db.competition.findMany({
      where: { owner },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(present);
  }
  async get(owner: string, id: string) {
    const row = await this.db.competition.findFirst({ where: { id, owner } });
    if (!row) throw missing();
    return present(row);
  }
  create(owner: string, name: string, ids: string[]) {
    return this.db.$transaction(async (tx) => {
      await lockOwnedBooks(tx, owner, ids);
      return insertCompetition(tx, owner, name, ids, null);
    });
  }
  choose(
    owner: string,
    id: string,
    revision: number,
    matchId: string,
    winnerId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const current = await locked(tx, owner, id, revision);
      const votes = vote(current.slots, current.votes, matchId, winnerId);
      if (votes === current.votes) return current;
      return present(
        await tx.competition.update({
          where: { id },
          data: { votes, revision: { increment: 1 } },
        }),
      );
    });
  }
  replace(
    owner: string,
    id: string,
    revision: number,
    slot: number,
    bookId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await lockOwnedBooks(tx, owner, [bookId]);
      const current = await locked(tx, owner, id, revision);
      if (current.slots[slot] !== null)
        throw new ConflictException("A vaga já está ocupada.");
      if (current.slots.includes(bookId))
        throw new BadRequestException("O livro já participa desta competição.");
      current.slots[slot] = bookId;
      return present(
        await tx.competition.update({
          where: { id },
          data: { slots: current.slots, revision: { increment: 1 } },
        }),
      );
    });
  }
}
