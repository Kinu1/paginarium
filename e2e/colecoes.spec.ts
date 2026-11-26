import { expect, test } from '@playwright/test'

for (const width of [390, 1440]) {
  test.describe(`Coleções em ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('reencontra o livro na lista de outro ano', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'))
      await page.goto('/')
      await page.getByRole('button', { name: /^Abrir O atlas das marés/ }).click()
      const ficha = page.getByRole('dialog')
      await ficha.getByLabel('Lista anual').fill('2024')
      await ficha.getByRole('button', { name: 'Incluir', exact: true }).click()
      await ficha.getByRole('button', { name: 'Salvar ficha' }).click()
      await expect(ficha).toHaveCount(0)
      await page.reload()
      if (width === 390) {
        await page.getByLabel('Coleção', { exact: true }).selectOption('planned')
      } else {
        await page.getByRole('button', { name: 'Lista do ano' }).click()
      }
      const year = page.getByLabel('Ano da lista de leitura')
      await expect(year).toHaveValue('2026')
      await year.selectOption('2024')
      const shelf = page.getByRole('region', { name: 'Lista do ano' })
      await expect(shelf.getByRole('button', { name: /^Abrir / })).toHaveCount(1)
      await expect(shelf.getByRole('button', { name: /^Abrir O atlas das marés/ })).toBeVisible()
      await year.selectOption('2026')
      await expect(shelf.getByRole('button', { name: /^Abrir / })).toHaveCount(5)
    })

    test('mostra as capas no arco-íris e na votação do favorito do ano', async ({ page }) => {
      await page.clock.setFixedTime(new Date('2026-09-15T12:00:00Z'))
      await page.goto('/')
      await page.getByRole('button', { name: 'Desafios', exact: true }).click()
      await page.getByRole('button', { name: 'Arco-íris', exact: true }).click()
      await page.getByRole('button', { name: 'Azul', exact: true }).click()
      await page.getByLabel('Vincular um livro da estante').selectOption({ label: 'O atlas das marés' })
      const slot = page.getByRole('button', { name: /Azul.*O atlas das marés/ })
      await expect(slot.locator('img')).toHaveAttribute('src', '/capas/atlas.jpg')
      await expect(slot).toBeFocused()
      await page.getByRole('navigation', { name: 'Desafios anuais' }).getByRole('button', { name: 'Favoritos' }).click()
      await page.getByLabel(/^agosto/i).selectOption({ label: 'O lado azul da montanha' })
      await page.getByLabel(/^setembro/i).selectOption({ label: 'A casa das peônias' })
      const candidate = page.getByRole('button', { name: 'A casa das peônias', exact: true })
      await expect(candidate.locator('img')).toHaveAttribute('src', '/capas/peonias.jpg')
      await expect(page.getByRole('button', { name: 'O lado azul da montanha', exact: true }).locator('img')).toBeVisible()
      await candidate.press('Space')
      await expect(candidate).toHaveAttribute('aria-pressed', 'true')
      const winner = page.getByRole('status').filter({ hasText: 'A casa das peônias' })
      await expect(winner.locator('img')).toHaveAttribute('src', '/capas/peonias.jpg')
    })
  })
}
