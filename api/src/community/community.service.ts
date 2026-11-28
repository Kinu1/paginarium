import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { PersonalChallenge } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import { Database } from "../database.js";
import { lockOwnedBooks } from "../book-links.js";
import { insertCompetition } from "../competition/competition.service.js";
import type { Rules, Format } from "./rules.js";

type Tx = Prisma.TransactionClient;
type Progress = Record<string, string>;
const missing = () => new NotFoundException("Desafio não encontrado.");
const stale = () =>
  new ConflictException(
    "O desafio mudou em outro acesso. Atualize para continuar.",
  );
function personal(row: PersonalChallenge) {
  return {
    id: row.id,
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    published: row.published,
    rules: row.rules as Rules,
    progress: row.progress as Progress,
  };
}
async function locked(tx: Tx, owner: string, id: string, revision: number) {
  const rows = await tx.$queryRaw<PersonalChallenge[]>`
    SELECT * FROM "PersonalChallenge" WHERE owner = ${owner} AND id = ${id}::uuid FOR UPDATE
  `;
  if (!rows.length) throw missing();
  if (rows[0].revision !== revision) throw stale();
  return rows[0];
}

@Injectable()
export class CommunityService {
  constructor(private readonly db: Database) {}
  async mine(owner: string) {
    const rows = await this.db.personalChallenge.findMany({
      where: { owner },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(personal);
  }
  async create(owner: string, rules: Rules) {
    return personal(
      await this.db.personalChallenge.create({
        data: { owner, format: rules.format, rules, progress: {} },
      }),
    );
  }
  async catalog(format: Format | undefined, page: number, pageSize: number) {
    const where = { published: true, format };
    const [items, total] = await this.db.$transaction(
      [
        this.db.personalChallenge.findMany({
          where,
          select: { id: true, rules: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.db.personalChallenge.count({ where }),
      ],
      { isolationLevel: "RepeatableRead" },
    );
    return {
      items: items.map((item) => ({ id: item.id, rules: item.rules as Rules })),
      total,
      page,
      pageSize,
    };
  }
  copy(owner: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ rules: Rules }[]>`
        SELECT rules FROM "PersonalChallenge" WHERE id = ${id}::uuid AND published = true FOR SHARE
      `;
      if (!rows.length) throw new NotFoundException("Modelo não disponível.");
      const rules = rows[0].rules;
      return personal(
        await tx.personalChallenge.create({
          data: { owner, format: rules.format, rules, progress: {} },
        }),
      );
    });
  }
  edit(
    owner: string,
    id: string,
    revision: number,
    rules: Rules,
    progress: Progress,
  ) {
    const valid = new Set(rules.items.map((item) => item.key));
    if (Object.keys(progress).some((k) => !valid.has(k)))
      throw new BadRequestException(
        "O progresso aponta para um item fora das regras do desafio.",
      );
    return this.db.$transaction(async (tx) => {
      await lockOwnedBooks(tx, owner, [
        ...new Set(Object.values(progress).filter((v) => v !== "*")),
      ]);
      const current = await locked(tx, owner, id, revision);
      if (current.format !== rules.format)
        throw new BadRequestException(
          "Crie um novo desafio para trocar o formato.",
        );
      return personal(
        await tx.personalChallenge.update({
          where: { id },
          data: { rules, progress, revision: { increment: 1 } },
        }),
      );
    });
  }
  publication(owner: string, id: string, revision: number, published: boolean) {
    return this.db.$transaction(async (tx) => {
      const current = await locked(tx, owner, id, revision);
      if (current.published === published) return personal(current);
      return personal(
        await tx.personalChallenge.update({
          where: { id },
          data: { published, revision: { increment: 1 } },
        }),
      );
    });
  }
  startCompetition(owner: string, id: string, revision: number, ids: string[]) {
    return this.db.$transaction(async (tx) => {
      await lockOwnedBooks(tx, owner, ids);
      const row = await locked(tx, owner, id, revision);
      if (row.format !== "competition")
        throw new BadRequestException("Este desafio usa outro formato.");
      if (await tx.competition.count({ where: { owner, challengeId: id } }))
        throw new ConflictException("Esta participação já tem uma competição.");
      const tournament = await insertCompetition(
        tx,
        owner,
        (row.rules as Rules).name,
        ids,
        id,
      );
      await tx.personalChallenge.update({
        where: { id },
        data: { revision: { increment: 1 } },
      });
      return tournament;
    });
  }
}
