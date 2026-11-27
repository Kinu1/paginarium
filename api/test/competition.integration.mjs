import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { fixture } from "./fixtures/challenge-db.mjs";
import { CompetitionService } from "../dist/competition/competition.service.js";
import { LibraryService } from "../dist/library.service.js";

test("persiste a chave privada, protege revisões e repõe apenas a vaga excluída", async () => {
  const { db, owner, other, books, foreign, addBook, close } = await fixture();
  const service = new CompetitionService(db);
  try {
    await assert.rejects(
      service.create(owner, "Inválida", [...books.slice(1), foreign.id]),
      (e) => e.getStatus() === 404,
    );
    let current = await service.create(owner, "Favoritos", books);
    assert.deepEqual((await service.list(owner))[0].slots, current.slots);
    assert.deepEqual(await service.list(other), []);
    await assert.rejects(
      service.get(other, current.id),
      (e) => e.getStatus() === 404,
    );
    const votes = await Promise.allSettled(
      [0, 1].map((i) =>
        service.choose(
          owner,
          current.id,
          current.revision,
          "P1",
          current.slots[i],
        ),
      ),
    );
    assert.equal(votes.filter((v) => v.status === "fulfilled").length, 1);
    assert.equal(
      votes.find((v) => v.status === "rejected").reason.getStatus(),
      409,
    );
    current = await service.get(owner, current.id);
    current = await service.choose(
      owner,
      current.id,
      current.revision,
      "P2",
      current.slots[2],
    );
    await new LibraryService(db).remove(owner, current.slots[0], 1);
    const vacant = await service.get(owner, current.id);
    assert.equal(vacant.slots[0], null);
    assert.deepEqual(vacant.slots.slice(1), current.slots.slice(1));
    assert.deepEqual(vacant.votes, { P2: current.slots[2] });
    await assert.rejects(
      service.choose(
        owner,
        current.id,
        vacant.revision,
        "P2",
        current.slots[3],
      ),
      (e) => e.getStatus() === 409,
    );
    await assert.rejects(
      service.replace(owner, current.id, vacant.revision, 0, current.slots[2]),
      (e) => e.getStatus() === 400,
    );
    const replacement = await addBook(owner, "Reposição");
    const filled = await service.replace(
      owner,
      current.id,
      vacant.revision,
      0,
      replacement.id,
    );
    assert.equal(filled.slots[0], replacement.id);
    assert.deepEqual(filled.votes, vacant.votes);
    assert.equal(
      (
        await service.choose(
          owner,
          current.id,
          filled.revision,
          "P1",
          replacement.id,
        )
      ).votes.P1,
      replacement.id,
    );
  } finally {
    await close();
  }
});
