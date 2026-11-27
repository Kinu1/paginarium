import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "./generated/prisma/client.js";
import { Database } from "./database.js";
import {
  parse,
  reading,
  type BookChanges,
  type BookMetadata,
  type NewBook,
  type YearChanges,
} from "./validation.js";
import type { Cover } from "./book-cover.js";
import { clearBookLinks, lockOwnedBooks } from "./book-links.js";

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
      started: true,
      currentPage: true,
      totalPages: true,
      progressPercent: true,
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

function identityOf(book: NewBook) {
  return (
    book.workKey ??
    book.editionKey ??
    createHash("sha256")
      .update(JSON.stringify([normalize(book.title), normalize(book.author)]))
      .digest("hex")
  );
}
const coverPath = (id: string) => "/books/" + id + "/cover";

async function missingOrConflict(
  tx: Prisma.TransactionClient,
  owner: string,
  id: string,
): Promise<never> {
  if (!(await tx.book.count({ where: { owner, id } })))
    throw new NotFoundException("Livro não encontrado.");
  throw conflict();
}

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

  async add(owner: string, book: NewBook, cover?: Cover) {
    const identity = identityOf(book);
    const id = randomUUID();
    const filter = { owner_identity: { owner, identity } };
    // A restrição única também protege duas inclusões simultâneas vindas de aparelhos diferentes.
    try {
      return await this.db.book.upsert({
        where: filter,
        update: {},
        create: {
          ...book,
          owner,
          identity,
          id,
          ...(cover && {
            coverUrl: coverPath(id),
            uploadedCover: { create: cover },
          }),
        },
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

  async metadata(
    owner: string,
    id: string,
    input: BookMetadata,
    cover?: Cover,
  ) {
    const { revision, ...changes } = input;
    if (!cover && !Object.keys(changes).length)
      throw new BadRequestException("Informe ao menos uma alteração.");
    try {
      return await this.db.$transaction(async (tx) => {
        const original = await tx.book.findFirst({
          where: { id, owner },
          select: {
            title: true,
            author: true,
            workKey: true,
            editionKey: true,
          },
        });
        if (!original) throw new NotFoundException("Livro não encontrado.");
        const updated = await tx.book.updateMany({
          where: { id, owner, revision },
          data: {
            ...changes,
            identity: identityOf({ ...original, ...changes }),
            revision: { increment: 1 },
            ...(cover && { coverUrl: coverPath(id) }),
          },
        });
        if (!updated.count) return missingOrConflict(tx, owner, id);
        if (cover)
          await tx.bookCover.upsert({
            where: { bookId: id },
            create: { bookId: id, ...cover },
            update: cover,
          });
        else if (changes.coverUrl !== undefined)
          await tx.bookCover.deleteMany({ where: { bookId: id } });
        return tx.book.findUniqueOrThrow({ where: { id }, select: bookView });
      });
    } catch (error) {
      if (dbCode(error, "P2002"))
        throw new ConflictException(
          "Este livro já está na estante com o mesmo título e autoria.",
        );
      throw error;
    }
  }

  async cover(owner: string, id: string) {
    const cover = await this.db.bookCover.findFirst({
      where: { bookId: id, book: { owner } },
      select: { mime: true, bytes: true },
    });
    if (!cover) throw new NotFoundException("Capa não encontrada.");
    return cover;
  }

  async remove(owner: string, id: string, revision: number) {
    await this.db.$transaction(async (tx) => {
      const deleted = await tx.book.deleteMany({
        where: { owner, id, revision },
      });
      if (!deleted.count) return missingOrConflict(tx, owner, id);
      await clearBookLinks(tx, owner, id);
    });
  }

  async save(owner: string, id: string, input: BookChanges) {
    return this.db.$transaction(async (tx) => {
      const { revision, readings, ...fields } = input;
      const changed = await tx.book.updateMany({
        where: { id, owner, revision },
        data: { ...fields, revision: { increment: 1 } },
      });
      if (!changed.count) return missingOrConflict(tx, owner, id);
      // Clientes antigos não enviam os campos de progresso. Preserve cada campo omitido.
      const existing = await tx.reading.findMany({
        where: { bookId: id },
        select: {
          id: true,
          started: true,
          currentPage: true,
          totalPages: true,
          progressPercent: true,
        },
      });
      const previous = new Map(existing.map((r) => [r.id, r]));
      const complete = readings.map((entry, position) => {
        const data = parse(reading, { ...previous.get(entry.id), ...entry });
        const pages = data.format !== "audio";
        const currentPage = pages ? (data.currentPage ?? null) : null;
        const totalPages = pages ? (data.totalPages ?? null) : null;
        const progressPercent = pages
          ? currentPage !== null && totalPages !== null
            ? Math.round((100 * currentPage) / totalPages)
            : null
          : (data.progressPercent ?? null);
        return {
          ...data,
          position,
          bookId: id,
          started: data.started ?? null,
          currentPage,
          totalPages,
          progressPercent,
        };
      });
      await tx.reading.deleteMany({ where: { bookId: id } });
      if (readings.length) await tx.reading.createMany({ data: complete });
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
        await lockOwnedBooks(tx, owner, ids);
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
