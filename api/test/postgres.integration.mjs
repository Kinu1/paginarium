import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { Database } from "../dist/database.js";
import { LibraryService } from "../dist/library.service.js";
import { parse, updateBook } from "../dist/validation.js";

if (!process.env.DATABASE_URL)
  throw new Error(
    "Configure DATABASE_URL para um banco local de testes com a migração aplicada.",
  );
const url = new URL(process.env.DATABASE_URL);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !url.pathname.endsWith("_test")
) {
  throw new Error(
    "O teste usa somente um PostgreSQL local cujo banco termina com _test.",
  );
}
const db = new Database();
const library = new LibraryService(db);
const owner = "teste-" + randomUUID();
const other = "teste-" + randomUUID();

after(async () => {
  await db.journalYear.deleteMany({ where: { owner: { in: [owner, other] } } });
  await db.book.deleteMany({ where: { owner: { in: [owner, other] } } });
  await db.$disconnect();
});

test("persiste o diário privado, mantém releituras e rejeita gravações concorrentes obsoletas", async () => {
  const input = {
    title: "Diário de teste",
    author: "Pessoa A",
    workKey: "/works/OL123W",
  };
  const [book, again] = await Promise.all([
    library.add(owner, input),
    library.add(owner, input),
  ]);
  assert.equal(book.id, again.id);
  assert.deepEqual(await library.list(other), []);
  const second = await library.add(other, input);
  assert.notEqual(book.id, second.id);

  const readings = [
    {
      id: randomUUID(),
      format: "physical",
      days: [],
      finished: "2025-01",
      rating: 0,
      favorite: false,
      review: "Primeira leitura",
    },
    {
      id: randomUUID(),
      format: "audio",
      days: ["2025-10-05", "2025-10-12"],
      finished: "2025-10-12",
      rating: 4.5,
      favorite: true,
      review: "Segunda leitura",
    },
  ];
  const changes = parse(updateBook, {
    revision: book.revision,
    status: "read",
    tags: ["nacional"],
    plannedYears: [2025],
    readings,
  });
  await assert.rejects(
    library.save(other, book.id, changes),
    (e) => e.getStatus() === 404,
  );
  const concurrent = await Promise.allSettled([
    library.save(owner, book.id, changes),
    library.save(owner, book.id, changes),
  ]);
  assert.equal(concurrent.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    concurrent.find((r) => r.status === "rejected").reason.getStatus(),
    409,
  );
  const [saved] = await library.list(owner);
  assert.equal(saved.revision, book.revision + 1);
  assert.equal(saved.readings.length, 2);
  assert.equal(saved.readings[0].rating, 0);
  assert.equal(saved.readings[1].rating, 4.5);

  const blank = await library.year(owner, 2025);
  const choices = { ...blank, squares: { a: "*" }, monthly: { 10: book.id } };
  const savedYear = await library.saveYear(owner, 2025, choices);
  assert.equal(savedYear.revision, 1);
  await assert.rejects(
    library.saveYear(owner, 2025, choices),
    (e) => e.getStatus() === 409,
  );
  await assert.rejects(
    library.saveYear(other, 2025, choices),
    (e) => e.getStatus() === 404,
  );
  assert.deepEqual(await library.year(other, 2025), blank);
});
