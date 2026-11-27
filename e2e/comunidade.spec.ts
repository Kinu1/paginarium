import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { api, entrar, leitor } from "./helpers/leitor";
import type { PersonalChallenge, TemplatePage } from "../shared/challenges";

test("duas contas veem só o modelo publicado e mantêm suas participações privadas", async ({
  page,
  request,
}) => {
  const owner = await leitor(request);
  const reader = await leitor(request);
  const title = "Clube " + randomUUID().slice(0, 8);
  const rules = {
    name: title,
    description: "Leituras de outono",
    instructions: "Vincule uma obra por meta.",
    format: "list",
    items: [{ key: "nacional", label: "Ler literatura brasileira" }],
  };
  const book = await request.post(api + "/books", {
    headers: owner.headers,
    data: { title: "Escolha pessoal", author: "Pessoa fictícia" },
  });
  expect(book.status()).toBe(201);
  const bookId = (await book.json()).id;
  const creation = await request.post(api + "/challenges", {
    headers: owner.headers,
    data: { rules },
  });
  expect(creation.status()).toBe(201);
  let original = (await creation.json()) as PersonalChallenge;
  const path = api + "/challenges/" + original.id;
  const progress = await request.put(path, {
    headers: owner.headers,
    data: {
      rules,
      revision: original.revision,
      progress: { nacional: bookId },
    },
  });
  expect(progress.ok()).toBeTruthy();
  original = await progress.json();
  const copyPath = api + "/challenges/templates/" + original.id + "/copy";
  expect(
    (
      await request.post(copyPath, { headers: reader.headers, data: {} })
    ).status(),
  ).toBe(404);
  expect((await request.get(api + "/challenges/templates")).status()).toBe(401);
  expect(
    (
      await request.put(path + "/publication", {
        headers: reader.headers,
        data: { revision: original.revision, published: true },
      })
    ).status(),
  ).toBe(404);
  const publish = await request.put(path + "/publication", {
    headers: owner.headers,
    data: { revision: original.revision, published: true },
  });
  expect(publish.ok()).toBeTruthy();
  original = await publish.json();
  try {
    const catalog = await request.get(
      api + "/challenges/templates?format=list&page=1&pageSize=50",
      { headers: reader.headers },
    );
    expect(catalog.ok()).toBeTruthy();
    const exposed = ((await catalog.json()) as TemplatePage).items.find(
      (t) => t.id === original.id,
    );
    expect(exposed).toEqual({ id: original.id, rules });
    await entrar(page, reader);
    await page.getByRole("button", { name: "Desafios", exact: true }).click();
    await page.getByRole("button", { name: "Comunidade", exact: true }).click();
    const template = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await expect(template).toBeVisible();
    await template.getByText("Ver regras").click();
    await expect(template.getByText("Ler literatura brasileira")).toBeVisible();
    await template.getByRole("button", { name: "Copiar desafio" }).click();
    await expect(
      page.getByRole("button", { name: "Editar desafio" }),
    ).toBeVisible();
    const copies = await request.get(api + "/challenges/mine", {
      headers: reader.headers,
    });
    const [copy] = (await copies.json()) as PersonalChallenge[];
    expect(copy.id).not.toBe(original.id);
    expect(copy.rules).toEqual(rules);
    expect(copy.progress).toEqual({});
    expect(copy.published).toBe(false);
    await page.getByRole("button", { name: "Editar desafio" }).click();
    await page.getByLabel("Nome do desafio").fill("Rascunho antigo");
    const otherDevice = await request.put(api + "/challenges/" + copy.id, {
      headers: reader.headers,
      data: { revision:copy.revision, rules:{...rules,name:title+" revisado"}, progress:{} },
    });
    expect(otherDevice.ok()).toBeTruthy();
    await page.getByRole("button", { name:"Salvar alterações" }).click();
    await expect(page.getByRole("alert")).toContainText("outro acesso");
    await page.getByRole("button", { name:/Descartar minhas alterações/ }).click();
    await expect(page.getByRole("heading", {name:title+" revisado"})).toBeVisible();
    await page.getByRole("button", { name:"Editar desafio" }).click();
    await expect(page.getByLabel("Nome do desafio")).toHaveValue(title+" revisado");
    await page.getByLabel("Nome do desafio").fill(title + " pessoal");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(
      page.getByRole("heading", { name: title + " pessoal" }),
    ).toBeVisible();
    const source = await request.get(api + "/challenges/mine", {
      headers: owner.headers,
    });
    const [unchanged] = (await source.json()) as PersonalChallenge[];
    expect(unchanged.rules.name).toBe(title);
    expect(unchanged.progress).toEqual({ nacional: bookId });
  } finally {
    const withdraw = await request.put(path + "/publication", {
      headers: owner.headers,
      data: { revision: original.revision, published: false },
    });
    expect(withdraw.ok()).toBeTruthy();
  }
  expect(
    (
      await request.post(copyPath, { headers: reader.headers, data: {} })
    ).status(),
  ).toBe(404);
  const after = await request.get(api + "/challenges/mine", {
    headers: reader.headers,
  });
  expect(((await after.json()) as PersonalChallenge[])[0].rules.name).toBe(
    title + " pessoal",
  );
});
