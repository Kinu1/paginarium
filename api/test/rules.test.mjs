import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { configuration } from "../dist/config.js";
import { searchResults } from "../dist/catalog.service.js";
import {
  createBook,
  parse,
  updateBook,
  updateYear,
} from "../dist/validation.js";

const reading = {
  id: randomUUID(),
  format: "physical",
  days: ["2024-02-29", "2024-03-02"],
  finished: "2024-03",
  rating: null,
  favorite: false,
  review: "",
};
const sample = (r) => ({
  revision: 1,
  status: "read",
  tags: ["romance"],
  plannedYears: [2024],
  readings: [r],
});

test("aceita mês de conclusão sem dias e distingue nota zero, meia-lua e ausência de nota", () => {
  for (const rating of [null, 0, 0.25, 4.5, 4.75, 5]) {
    const row = parse(updateBook, sample({ ...reading, days: [], rating }))
      .readings[0];
    assert.equal(row.finished, "2024-03");
    assert.equal(row.rating, rating);
  }
});

test("mantém datas não consecutivas, rejeita datas inexistentes e notas fora de escala", () => {
  assert.equal(parse(updateBook, sample(reading)).readings[0].days.length, 2);
  for (const changes of [
    { days: ["2025-02-29"] },
    { days: ["2024-03-02", "2024-03-02"] },
    { rating: 4.1 },
    { finished: "2025-13" },
    { rating: 6 },
    { days: ["2024-04-01"] },
  ]) {
    assert.throws(() => parse(updateBook, sample({ ...reading, ...changes })));
  }
});

test("aceita releituras com fichas independentes", () => {
  const second = {
    ...reading,
    id: randomUUID(),
    format: "audio",
    review: "Nova impressão.",
  };
  const parsed = parse(updateBook, {
    ...sample(reading),
    readings: [reading, second],
  });
  assert.deepEqual(
    parsed.readings.map((r) => r.format),
    ["physical", "audio"],
  );
});

test("aceita registro manual sem capa e rejeita proprietário enviado pelo cliente", () => {
  assert.deepEqual(parse(createBook, { title: "Livro", author: "Autora" }), {
    title: "Livro",
    author: "Autora",
  });
  assert.throws(() =>
    parse(createBook, {
      title: "Livro",
      author: "Autora",
      owner: "outra-conta",
    }),
  );
});

test("permite marcação manual apenas no bingo", () => {
  const blank = {
    revision: 0,
    squares: { 1: "*" },
    letters: {},
    colors: {},
    monthly: {},
    rounds: {},
  };
  assert.ok(updateYear.safeParse(blank).success);
  assert.equal(
    updateYear.safeParse({ ...blank, monthly: { 1: "*" } }).success,
    false,
  );
});

test("seleciona título e capa da edição encontrada na Open Library", () => {
  const [book] = searchResults([
    {
      key: "/works/OL1W",
      title: "Original",
      author_name: ["Autora"],
      editions: {
        docs: [{ key: "/books/OL2M", title: "Tradução", cover_i: 123 }],
      },
    },
  ]);
  assert.equal(book.title, "Tradução");
  assert.match(book.coverUrl, /123-M\.jpg$/);
});

test("configuração de produção exige origens HTTPS e desativa o emulador", () => {
  const production = {
    DATABASE_URL: "postgres://localhost/db",
    FIREBASE_PROJECT_ID: "paginarium",
    NODE_ENV: "production",
    WEB_ORIGIN: "https://paginarium.example",
  };
  assert.equal(configuration(production).port, 3000);
  assert.throws(() =>
    configuration({
      ...production,
      FIREBASE_AUTH_EMULATOR_HOST: "localhost:9099",
    }),
  );
  assert.throws(() => configuration({ ...production, WEB_ORIGIN: "*" }));
  const local = {
    ...production,
    NODE_ENV: "development",
    FIREBASE_PROJECT_ID: "demo-paginarium",
    FIREBASE_AUTH_EMULATOR_HOST: "auth:9099",
  };
  assert.doesNotThrow(() => configuration(local));
  assert.throws(() =>
    configuration({ ...local, FIREBASE_PROJECT_ID: "conta-real" }),
  );
  assert.throws(() => configuration({ ...local, NODE_ENV: "production" }));
});
