import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

for (const width of [390, 1440]) {
  test.describe(`Cadastro em ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } })
    test('confere as senhas e abre a primeira estante da conta', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('button', { name: 'Criar uma conta' }).click()
      const password = randomUUID()
      const attempts: string[] = []
      page.on('request', req => { if (req.url().includes('accounts:signUp')) attempts.push(req.method()) })
      await dialog.getByLabel('E-mail', { exact: true }).fill(randomUUID() + '@example.test')
      await dialog.getByLabel('Senha', { exact: true }).fill(password)
      const confirmation = dialog.getByLabel('Confirmar senha')
      await confirmation.fill(password + 'x')
      await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
      await expect(confirmation).toBeFocused()
      await expect(confirmation).toHaveAccessibleDescription('As senhas precisam ser iguais.')
      expect(attempts).toHaveLength(0)
      await confirmation.fill(password)
      await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByText(/^0 livros na estante/)).toBeVisible()
      await page.reload()
      await expect(page.getByRole('button', { name: 'Gerenciar conta', exact: true })).toBeVisible()
      await expect(page.getByText(/^0 livros na estante/)).toBeVisible()
    })
  })
}
