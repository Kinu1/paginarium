import { randomUUID } from "node:crypto";
import { Database } from "../../dist/database.js";

/** Cada suíte usa donos únicos em um banco local de teste já migrado. */
export async function fixture() {
  const url = new URL(process.env.DATABASE_URL || "http://missing");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !url.pathname.endsWith("_test")
  )
    throw new Error(
      "A suíte exige um PostgreSQL de teste local com sufixo _test.",
    );
  const db = new Database();
  const owner = "teste-" + randomUUID();
  const other = "teste-" + randomUUID();
  async function addBook(user, title) {
    return db.book.create({
      data: {
        owner: user,
        title,
        author: "Pessoa fictícia",
        identity: randomUUID(),
      },
    });
  }
  const books = [];
  for (let i = 0; i < 22; i++)
    books.push((await addBook(owner, "Livro " + i)).id);
  const foreign = await addBook(other, "Outro diário");
  return {
    db,
    owner,
    other,
    books,
    foreign,
    addBook,
    close: async () => {
      const where = { owner: { in: [owner, other] } };
      await db.competition.deleteMany({ where });
      await db.book.deleteMany({ where });
      await db.$disconnect();
    },
  };
}
