import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import sharp from "sharp";
import { bookInput, checkCover, maxCoverBytes } from "../dist/book-cover.js";
import {
  parse,
  parseRevision,
  patchBook,
  updateBook,
} from "../dist/validation.js";

test("PATCH aceita remover capa, preservar metadados omitidos e requer revisão", () => {
  assert.deepEqual(
    bookInput("application/json", { revision: 1, coverUrl: null }, patchBook),
    { revision: 1, coverUrl: null },
  );
  assert.deepEqual(
    bookInput(
      "multipart/form-data; boundary=test",
      { data: '{"revision":2,"title":"Mar"}' },
      patchBook,
    ),
    { revision: 2, title: "Mar" },
  );
  assert.throws(() =>
    bookInput("multipart/form-data", { data: "{" }, patchBook),
  );
  assert.throws(() => parse(patchBook, { title: "Erro" }));
  assert.throws(() =>
    parse(patchBook, { revision: 1, coverUrl: "http://example.org/imagem" }),
  );
  assert.throws(() => parseRevision("0"));
  assert.throws(() => parseRevision(undefined));
  assert.equal(parseRevision("12"), 12);
});

test("capa até 150 KiB precisa ter MIME e conteúdo válidos", async () => {
  for (const [format, mimetype] of [
    ["jpeg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ]) {
    const buffer = await sharp({
      create: { width: 4, height: 5, channels: 3, background: "pink" },
    })
      [format]()
      .toBuffer();
    const cover = await checkCover({ buffer, mimetype });
    assert.equal(cover.mime, mimetype);
    assert.deepEqual(Buffer.from(cover.bytes), buffer);
    const wrong = mimetype === "image/jpeg" ? "image/png" : "image/jpeg";
    await assert.rejects(
      checkCover({ buffer, mimetype: wrong }),
      (e) => e.getStatus() === 400,
    );
  }
  await assert.rejects(
    checkCover({
      buffer: Buffer.alloc(maxCoverBytes + 1),
      mimetype: "image/jpeg",
    }),
    (e) => e.getStatus() === 413,
  );
  await assert.rejects(
    checkCover({ buffer: Buffer.from("não é jpeg"), mimetype: "image/jpeg" }),
    (e) => e.getStatus() === 400,
  );
  await assert.rejects(
    checkCover({
      buffer: Buffer.from("<svg></svg>"),
      mimetype: "image/svg+xml",
    }),
    (e) => e.getStatus() === 415,
  );
});

test("permite abandono, valida datas de início / conclusão e limites de páginas / porcentagem", () => {
  const row = {
    id: randomUUID(),
    format: "physical",
    days: ["2026-05-12"],
    finished: null,
    rating: null,
    favorite: false,
    review: "",
    started: "2026-05-01",
    currentPage: 0,
    totalPages: 42,
    progressPercent: null,
  };
  const wrap = (r) => ({
    revision: 1,
    status: "abandoned",
    tags: [],
    plannedYears: [],
    readings: [r],
  });
  assert.ok(updateBook.safeParse(wrap(row)).success);
  for (const edit of [
    { started: "2026-05-16" },
    { finished: "2026-04" },
    { currentPage: 43 },
    { totalPages: 0 },
    { currentPage: -1 },
    { progressPercent: 101 },
  ]) {
    assert.throws(() => parse(updateBook, wrap({ ...row, ...edit })));
  }
  assert.ok(
    updateBook.safeParse(
      wrap({ ...row, started: "2026-05-12", finished: "2026-05" }),
    ).success,
  );
});
