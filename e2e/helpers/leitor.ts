import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export const api =
  process.env.PAGINARIUM_TEST_API || "http://localhost:3000/api";
const web = process.env.PAGINARIUM_TEST_WEB || "http://localhost:5173";
const emulator =
  "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-local";

export async function leitor(request: APIRequestContext) {
  const email = randomUUID() + "@example.test";
  const password = randomUUID();
  const response = await request.post(emulator, {
    data: { email, password, returnSecureToken: true },
  });
  expect(response.status()).toBe(200);
  const { idToken } = await response.json();
  return { email, password, headers: { Authorization: "Bearer " + idToken } };
}
export async function entrar(
  page: Page,
  user: { email: string; password: string },
) {
  await page.goto(web);
  await page
    .getByRole("button", { name: "Entrar na minha conta", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("E-mail", { exact: true }).fill(user.email);
  await dialog.getByLabel("Senha", { exact: true }).fill(user.password);
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Gerenciar conta", exact: true }),
  ).toBeVisible();
}
