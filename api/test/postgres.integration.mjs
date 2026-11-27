import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import sharp from "sharp";
import { checkCover } from "../dist/book-cover.js";
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

test("capa privada, metadados versionados, progresso e remoção atômica dos vínculos", async () => {
  const original = { title: "Mar de papel", author: "Lua" };
  const image = await sharp({
    create: { width: 2, height: 3, channels: 3, background: "blue" },
  })
    .jpeg()
    .toBuffer();
  const cover = await checkCover({ buffer: image, mimetype: "image/jpeg" });
  const book = await library.add(owner, original, cover);
  const ownUrl = "/books/" + book.id + "/cover";
  assert.equal(book.coverUrl, ownUrl);
  assert.deepEqual(
    Buffer.from((await library.cover(owner, book.id)).bytes),
    image,
  );
  await assert.rejects(
    library.cover(other, book.id),
    (e) => e.getStatus() === 404,
  );
  await assert.rejects(
    library.metadata(other, book.id, {
      revision: book.revision,
      title: "Indevido",
    }),
    (e) => e.getStatus() === 404,
  );
  const renamed = await library.metadata(owner, book.id, {
    revision: book.revision,
    title: "Mar sem fim",
  });
  assert.equal(renamed.coverUrl, ownUrl);
  assert.equal(
    (await library.add(owner, { ...original, title: renamed.title })).id,
    book.id,
  );
  await assert.rejects(
    library.metadata(owner, book.id, {
      revision: book.revision,
      coverUrl: null,
    }),
    (e) => e.getStatus() === 409,
  );
  const external = await library.metadata(owner, book.id, {
    revision: renamed.revision,
    coverUrl: "https://example.org/capa.jpg",
  });
  await assert.rejects(
    library.cover(owner, book.id),
    (e) => e.getStatus() === 404,
  );
  const again = await library.metadata(
    owner,
    book.id,
    { revision: external.revision },
    cover,
  );
  const removedCover = await library.metadata(owner, book.id, {
    revision: again.revision,
    coverUrl: null,
  });
  assert.equal(removedCover.coverUrl, null);
  const ready = await library.metadata(
    owner,
    book.id,
    { revision: removedCover.revision },
    cover,
  );
  const row = {
    id: randomUUID(),
    format: "ebook",
    days: [],
    finished: null,
    started: "2026-01-01",
    rating: null,
    favorite: false,
    review: "Continua amanhã",
    currentPage: 21,
    totalPages: 80,
    progressPercent: 99,
  };
  const progress = await library.save(
    owner,
    book.id,
    parse(updateBook, {
      revision: ready.revision,
      status: "reading",
      tags: [],
      plannedYears: [],
      readings: [row],
    }),
  );
  assert.equal(progress.readings[0].progressPercent, 26);
  const legacy = {
    id: row.id,
    format: row.format,
    days: [],
    finished: null,
    rating: null,
    favorite: false,
    review: "Anotação nova",
  };
  const cancelled = await library.save(
    owner,
    book.id,
    parse(updateBook, {
      revision: progress.revision,
      status: "abandoned",
      tags: [],
      plannedYears: [],
      readings: [legacy],
    }),
  );
  assert.equal(cancelled.readings[0].currentPage, 21);
  assert.equal(cancelled.readings[0].started, row.started);
  const audio = await library.save(
    owner,
    book.id,
    parse(updateBook, {
      revision: cancelled.revision,
      status: "reading",
      tags: [],
      plannedYears: [],
      readings: [{ ...legacy, format: "audio", progressPercent: 12.5 }],
    }),
  );
  assert.equal(audio.readings[0].currentPage, null);
  assert.equal(audio.readings[0].progressPercent, 12.5);

  const year = await library.year(owner, 2031);
  const chosen = await library.saveYear(owner, 2031, {
    ...year,
    squares: { one: "*", two: book.id },
    letters: { M: book.id },
    colors: { Azul: book.id },
    monthly: { 1: book.id },
    rounds: { r0: book.id },
  });
  const safe = await library.add(other, original);
  const otherYear = await library.year(other, 2031);
  await library.saveYear(other, 2031, {
    ...otherYear,
    letters: { M: safe.id },
  });
  await assert.rejects(
    library.remove(other, book.id, audio.revision),
    (e) => e.getStatus() === 404,
  );
  await assert.rejects(
    library.remove(owner, book.id, ready.revision),
    (e) => e.getStatus() === 409,
  );
  await library.remove(owner, book.id, audio.revision);
  assert.equal(
    (await library.list(owner)).some((b) => b.id === book.id),
    false,
  );
  assert.equal(await db.bookCover.count({ where: { bookId: book.id } }), 0);
  assert.equal(await db.reading.count({ where: { bookId: book.id } }), 0);
  assert.deepEqual(await library.year(owner, 2031), {
    revision: chosen.revision + 1,
    squares: { one: "*" },
    letters: {},
    colors: {},
    monthly: {},
    rounds: {},
  });
  assert.equal((await library.year(other, 2031)).letters.M, safe.id);
});
