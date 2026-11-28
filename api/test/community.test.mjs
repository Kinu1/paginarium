import assert from "node:assert/strict";
import test from "node:test";
import { progressSchema, rulesSchema } from "../dist/community/rules.js";

test("o progresso guarda a referência canônica ao livro e conserva a marca manual", () => {
  const id = "a1234567-1234-4123-8123-123456789abc";
  assert.deepEqual(progressSchema.parse({ a: id.toUpperCase(), b: "*" }), { a: id, b: "*" });
});

const base = {
  name: "Metas",
  description: "Um ano de leituras",
  instructions: "Escolha um livro por item",
};
function rule(format, keys) {
  return {
    ...base,
    format,
    items: keys.map((key) => ({ key, label: "Critério " + key })),
  };
}
test("valida as chaves de cada formato e mantém o centro do bingo livre", () => {
  const bingo = Array.from({ length: 25 }, (_, i) => String(i)).filter(
    (v) => v !== "12",
  );
  assert.ok(rulesSchema.safeParse(rule("bingo", bingo)).success);
  assert.ok(!rulesSchema.safeParse(rule("bingo", [...bingo, "12"])).success);
  assert.ok(
    rulesSchema.safeParse(rule("alphabet", [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"]))
      .success,
  );
  assert.ok(!rulesSchema.safeParse(rule("alphabet", ["A", "B"])).success);
  assert.ok(
    rulesSchema.safeParse(
      rule("rainbow", [
        "Vermelho",
        "Laranja",
        "Amarelo",
        "Verde",
        "Azul",
        "Anil",
        "Violeta",
      ]),
    ).success,
  );
  assert.ok(rulesSchema.safeParse(rule("competition", [])).success);
  assert.ok(!rulesSchema.safeParse(rule("list", ["uma", "uma"])).success);
  assert.ok(
    !rulesSchema.safeParse({
      ...rule("list", ["livro"]),
      review: "resenha privada",
    }).success,
  );
});
