import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures/challenge-db.mjs";
import { CommunityService } from "../dist/community/community.service.js";
import { BooksController } from "../dist/controllers.js";
import { LibraryService } from "../dist/library.service.js";
import { CompetitionService } from "../dist/competition/competition.service.js";
import { updateYear } from "../dist/validation.js";
import { progressSchema } from "../dist/community/rules.js";

test("publica só regras e a cópia editável nasce privada e independente", async () => {
  const { db, owner, other, books, foreign, close } = await fixture();
  const svc = new CommunityService(db);
  const rules = {
    name: "Meta",
    description: "Projeto de leitura",
    instructions: "Marque ao concluir",
    format: "list",
    items: [{ key: "1", label: "Literatura nacional" }],
  };
  try {
    let item = await svc.create(owner, rules);
    await assert.rejects(
      svc.copy(other, item.id),
      (e) => e.getStatus() === 404,
    );
    await assert.rejects(
      svc.edit(owner, item.id, item.revision, rules, { 1: foreign.id }),
      (e) => e.getStatus() === 404,
    );
    item = await svc.edit(owner, item.id, item.revision, rules,
      progressSchema.parse({ 1: books[0].toUpperCase() }),
    );
    await assert.rejects(
      svc.publication(other, item.id, item.revision, true),
      (e) => e.getStatus() === 404,
    );
    item = await svc.publication(owner, item.id, item.revision, true);
    let extra = await svc.create(owner, { ...rules, name: "Outra lista" });
    extra = await svc.publication(owner, extra.id, extra.revision, true);
    const page = await svc.catalog("list", 1, 1);
    const next = await svc.catalog("list", 2, 1);
    assert.equal(page.items.length, 1);
    assert.equal(next.items.length, 1);
    assert.notEqual(page.items[0].id, next.items[0].id);
    assert.ok(page.total >= 2);
    assert.deepEqual(Object.keys(page.items[0]).sort(), ["id", "rules"]);
    assert.ok((await svc.catalog("bingo", 1, 50)).items.every(i => i.rules.format === "bingo"));
    const copied = await svc.copy(other, item.id);
    assert.notEqual(copied.id, item.id);
    assert.deepEqual(copied.rules, rules);
    assert.deepEqual(copied.progress, {});
    assert.equal(copied.published, false);
    item = await svc.publication(owner, item.id, item.revision, false);
    await assert.rejects(svc.copy(other, item.id), e => e.getStatus() === 404);
    assert.deepEqual((await svc.mine(other))[0].rules, rules);
    await assert.rejects(
      svc.edit(owner, item.id, item.revision - 1, rules, {}),
      (e) => e.getStatus() === 409,
    );
    const tournamentRules = { ...rules, format: "competition", items: [] };
    const model = await svc.create(owner, tournamentRules);
    const tournament = await svc.startCompetition(
      owner,
      model.id,
      model.revision,
      books,
    );
    assert.equal(tournament.challengeId, model.id);
    assert.equal(tournament.matches.length, 21);
    await assert.rejects(
      svc.startCompetition(owner, model.id, model.revision, books),
      (e) => e.getStatus() === 409,
    );
    await assert.rejects(
      svc.startCompetition(owner, model.id, model.revision + 1, books),
      (e) => e.getStatus() === 409,
    );
    const library = new LibraryService(db);
    const upper = books[0].toUpperCase();
    await library.saveYear(owner, 2026, updateYear.parse({
      revision: 0, squares: { meta: upper }, letters: {}, colors: {}, monthly: {}, rounds: {},
    }));
    await new BooksController(library).remove(owner, upper, "1");
    const after = await new CompetitionService(db).get(owner, tournament.id);
    assert.equal(after.slots[tournament.slots.indexOf(books[0])], null);
    assert.equal(after.slots.filter(Boolean).length, 21);
    assert.deepEqual((await library.year(owner, 2026)).squares, {});
    assert.deepEqual((await svc.mine(owner)).find(challenge => challenge.id === item.id).progress, {});
  } finally {
    await db.journalYear.deleteMany({ where: { owner } });
    await db.personalChallenge.deleteMany({
      where: { owner: { in: [owner, other] } },
    });
    await close();
  }
});
