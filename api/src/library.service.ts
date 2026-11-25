import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "./generated/prisma/client.js";
import { Database } from "./database.js";
import type { BookChanges, NewBook, YearChanges } from "./validation.js";

const bookView = {
  id: true,
  title: true,
  author: true,
  coverUrl: true,
  workKey: true,
  editionKey: true,
  revision: true,
  status: true,
  tags: true,
  plannedYears: true,
  readings: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      format: true,
      days: true,
      finished: true,
      rating: true,
      favorite: true,
      review: true,
    },
  },
} satisfies Prisma.BookSelect;
const yearView = {
  revision: true,
  squares: true,
  letters: true,
  colors: true,
  monthly: true,
  rounds: true,
} as const;

const conflict = () =>
  new ConflictException(
    "O diário foi alterado em outro dispositivo. Recarregue para continuar.",
  );
const normalize = (s: string) =>
  s.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const dbCode = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

@Injectable()
export class LibraryService {
  constructor(private readonly db: Database) {}

  list(owner: string) {
    return this.db.book.findMany({
      where: { owner },
      select: bookView,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  }

  async add(owner: string, book: NewBook) {
    const customKey = createHash("sha256")
      .update(JSON.stringify([normalize(book.title), normalize(book.author)]))
      .digest("hex");
    const identity = book.workKey ?? book.editionKey ?? customKey;
    const filter = { owner_identity: { owner, identity } };
    // A restrição única também protege duas inclusões simultâneas vindas de aparelhos diferentes.
    try {
      return await this.db.book.upsert({
        where: filter,
        update: {},
        create: { ...book, owner, identity },
        select: bookView,
      });
    } catch (error) {
      if (dbCode(error, "P2002"))
        return this.db.book.findUniqueOrThrow({
          where: filter,
          select: bookView,
        });
      throw error;
    }
  }

  async save(owner: string, id: string, input: BookChanges) {
    return this.db.$transaction(async (tx) => {
      const { revision, readings, ...fields } = input;
      const changed = await tx.book.updateMany({
        where: { id, owner, revision },
        data: { ...fields, revision: { increment: 1 } },
      });
      if (!changed.count) {
        const own = await tx.book.count({ where: { id, owner } });
        if (!own) throw new NotFoundException("Livro não encontrado.");
        throw conflict();
      }
      await tx.reading.deleteMany({ where: { bookId: id } });
      if (readings.length)
        await tx.reading.createMany({
          data: readings.map((r, position) => ({ ...r, position, bookId: id })),
        });
      return tx.book.findFirstOrThrow({
        where: { id, owner },
        select: bookView,
      });
    });
  }

  async year(owner: string, year: number) {
    return (
      (await this.db.journalYear.findUnique({
        where: { owner_year: { owner, year } },
        select: yearView,
      })) ?? {
        revision: 0,
        squares: {},
        letters: {},
        colors: {},
        monthly: {},
        rounds: {},
      }
    );
  }

  async saveYear(owner: string, year: number, input: YearChanges) {
    const { revision, ...maps } = input;
    const ids = [
      ...new Set(
        Object.values(maps)
          .flatMap((m) => Object.values(m))
          .filter((id) => id !== "*"),
      ),
    ];
    try {
      return await this.db.$transaction(async (tx) => {
        if (
          ids.length &&
          (await tx.book.count({ where: { owner, id: { in: ids } } })) !==
            ids.length
        )
          throw new NotFoundException(
            "O livro selecionado não está nesta estante.",
          );
        if (revision === 0)
          return tx.journalYear.create({
            data: { ...maps, owner, year, revision: 1 },
            select: yearView,
          });
        const changed = await tx.journalYear.updateMany({
          where: { owner, year, revision },
          data: { ...maps, revision: { increment: 1 } },
        });
        if (!changed.count) throw conflict();
        return tx.journalYear.findUniqueOrThrow({
          where: { owner_year: { owner, year } },
          select: yearView,
        });
      });
    } catch (error) {
      if (dbCode(error, "P2002")) throw conflict();
      throw error;
    }
  }
}
