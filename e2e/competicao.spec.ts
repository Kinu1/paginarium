import { expect, test, type Page } from "@playwright/test";
import { api, entrar, leitor } from "./helpers/leitor";
import type { Competition } from "../shared/competition";

async function abrir(page: Page) {
  await page.getByRole("button", { name: "Desafios", exact: true }).click();
  await page.getByRole("button", { name: "Competição", exact: true }).click();
}
for (const width of [390, 1440]) {
  test.describe("Competição em " + width + "px", () => {
    test.use({ viewport: { width, height: 900 } });
    test("completa os 21 confrontos, muda um voto e repõe a vaga de um livro excluído", async ({
      page,
      request,
    }) => {
      const user = await leitor(request);
      const { headers } = user;
      const books: { id: string; title: string; revision: number }[] = [];
      for (let i = 1; i <= 23; i++) {
        const result = await request.post(api + "/books", {
          headers,
          data: {
            title: "Obra " + String(i).padStart(2, "0"),
            author: "Autoria fictícia",
          },
        });
        expect(result.status()).toBe(201);
        books.push(await result.json());
      }
      await entrar(page, user);
      await abrir(page);
      await page.getByLabel("Nome da competição").fill("Estante do ano");
      for (const book of books.slice(0, 22))
        await page
          .getByRole("checkbox", { name: book.title, exact: true })
          .check();
      await page.getByRole("button", { name: "Sortear chave" }).click();
      const panel = page.getByRole("region", { name: "Competição de livros" });
      const pair = (id: string) =>
        panel.getByRole("group", { name: id, exact: true });
      await expect(
        panel.getByRole("heading", { name: "Estante do ano" }),
      ).toBeVisible();
      const sequence = [
        "P1",
        "P2",
        "P3",
        "P4",
        "P5",
        "P6",
        "O1",
        "O2",
        "O3",
        "O4",
        "O5",
        "O6",
        "O7",
        "O8",
        "Q1",
        "Q2",
        "Q3",
        "Q4",
        "S1",
        "S2",
        "F1",
      ];
      for (const id of sequence) {
        const left = pair(id).getByRole("button").first();
        await left.click();
        await expect(left).toHaveAttribute("aria-pressed", "true");
      }
      await expect(panel.getByRole("status")).toContainText("Campeão");
      const fetchTournament = async () => {
        const results = await request.get(api + "/competitions", { headers });
        expect(results.ok()).toBeTruthy();
        return ((await results.json()) as Competition[])[0];
      };
      const won = await fetchTournament();
      expect(Object.keys(won.votes)).toHaveLength(21);
      await pair("P1").getByRole("button").nth(1).click();
      await expect(panel.getByText(/Campeão ·/)).toHaveCount(0);
      const changed = await fetchTournament();
      for (const affected of ["O1", "Q1", "S1", "F1"])
        expect(changed.votes[affected]).toBeUndefined();
      expect(changed.votes.S2).toBe(won.votes.S2);
      const removed = books.find((b) => b.id === won.slots[0])!;
      expect(
        (
          await request.delete(
            api + "/books/" + removed.id + "?revision=" + removed.revision,
            { headers },
          )
        ).status(),
      ).toBe(204);
      await page.reload();
      await abrir(page);
      const replace = page.getByRole("combobox", {
        name: /Repor participante da vaga 1/,
      });
      await expect(replace).toBeVisible();
      await expect(pair("P2").getByRole("button").first()).toBeDisabled();
      await replace.selectOption(books[22].id);
      await expect(replace).toHaveCount(0);
      await expect(pair("P1").getByRole("button").first()).toBeEnabled();
      const filled = await fetchTournament();
      expect(filled.slots).toEqual([books[22].id, ...won.slots.slice(1)]);
      expect(filled.votes.S2).toBe(won.votes.S2);
    });
  });
}
