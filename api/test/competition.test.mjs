import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { participants } from "../dist/competition/competition.module.js";
import {
  draw,
  invalidate,
  matches,
  pairs,
  vote,
} from "../dist/competition/bracket.js";

const books = Array.from({ length: 22 }, (_, i) => "livro-" + i);

test("normaliza os participantes e rejeita o mesmo livro com grafias distintas", () => {
  const ids = Array.from({ length: 22 }, () => randomUUID());
  const uppercase = ids.map((id) => id.toUpperCase());
  assert.deepEqual(participants.parse(uppercase), ids);
  assert.equal(participants.safeParse([ids[1], ...uppercase.slice(1)]).success, false);
});

test("22 obras disputam seis preliminares antes das oitavas e precisam de 21 votos", () => {
  const slots = draw(books);
  assert.deepEqual([...slots].sort(), [...books].sort());
  assert.throws(() => draw(books.slice(1)));
  assert.throws(() => draw([...books.slice(1), books[1]]));
  assert.equal(pairs.filter((p) => p.round === "preliminary").length, 6);
  const leaves = pairs
    .flatMap((p) => [p.left, p.right])
    .filter((v) => typeof v === "number");
  assert.equal(new Set(leaves).size, 22);
  assert.equal(leaves.length, 22);
  let votes = {};
  for (const pair of pairs) {
    const match = matches(slots, votes).find((m) => m.id === pair.id);
    assert.ok(match.left && match.right);
    votes = vote(slots, votes, match.id, match.left);
  }
  assert.equal(Object.keys(votes).length, 21);
  assert.ok(matches(slots, votes).at(-1).winner);
  const changed = vote(slots, votes, "P1", slots[1]);
  for (const child of ["O1", "Q1", "S1", "F1"])
    assert.equal(changed[child], undefined);
  for (const other of ["P2", "O2", "Q2", "S2"])
    assert.equal(changed[other], votes[other]);
  const vacancy = [...slots];
  vacancy[0] = null;
  const afterDelete = invalidate(0, votes);
  assert.equal(afterDelete.P1, undefined);
  assert.equal(afterDelete.O2, votes.O2);
  assert.throws(() => vote(vacancy, afterDelete, "P2", slots[2]));
});
