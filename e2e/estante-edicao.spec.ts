import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9L0AAAAASUVORK5CYII=',
  'base64',
)

for (const scope of ['demonstração', 'conta privada'] as const) {
  test('edita capa, retoma o progresso e exclui o livro na ' + scope, async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    if (scope === 'conta privada') {
      const email = randomUUID() + '@example.test'
      const password = randomUUID()
      const created = await request.post(
        'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-local',
        {
          data: { email, password, returnSecureToken: true },
        },
      )
      expect(created.ok()).toBeTruthy()
      await page.getByRole('button', { name: 'Entrar na minha conta', exact: true }).click()
      await page.getByLabel('E-mail', { exact: true }).fill(email)
      await page.getByLabel('Senha', { exact: true }).fill(password)
      await page.getByRole('button', { name: 'Entrar', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Gerenciar conta', exact: true })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Adicionar livro', exact: true }).click()
    await page.getByRole('button', { name: 'Adicionar manualmente' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel('Título', { exact: true }).fill('Caderno da praia')
    await dialog.getByLabel('Autoria', { exact: true }).fill('Autora de teste')
    const file = { name: 'capa.png', mimeType: 'image/png', buffer: image }
    await dialog.getByLabel('Enviar imagem').setInputFiles(file)
    await expect(dialog.getByText(/Capa preparada/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Adicionar à estante' }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Caderno da praia' })).toBeVisible()
    await expect(dialog.locator('.jr-head-art img')).toBeVisible()
    await dialog.getByLabel('Situação na estante').selectOption('reading')
    await dialog.getByLabel('Data de início').fill('2025-03-01')
    await dialog.getByLabel('Página atual').fill('45')
    await dialog.getByLabel('Total de páginas').fill('180')
    await expect(dialog.getByText('Progresso da leitura · 25%')).toBeVisible()
    await dialog.getByLabel('Situação na estante').selectOption('abandoned')
    await dialog.getByRole('button', { name: 'Salvar ficha' }).click()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await page.getByRole('button', { name: /Abrir Caderno da praia/ }).click()
    await dialog.getByRole('button', { name: 'Retomar leitura' }).click()
    await expect(dialog.getByLabel('Página atual')).toHaveValue('45')
    await expect(dialog.getByLabel('Data de início')).toHaveValue('2025-03-01')
    await dialog.getByLabel('Minha resenha').fill('Texto em andamento.')
    await dialog.getByRole('button', { name: 'Editar livro' }).click()
    await dialog.getByLabel('Título', { exact: true }).fill('Caderno do mar')
    await dialog.getByLabel('Autoria', { exact: true }).fill('Outra autoria')
    await dialog.getByRole('button', { name: 'Remover capa' }).click()
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(dialog.getByRole('heading', { name: 'Caderno do mar' })).toBeVisible()
    await expect(dialog.locator('.jr-head-art img')).toHaveCount(0)
    await expect(dialog.getByLabel('Minha resenha')).toHaveValue('Texto em andamento.')
    await dialog.getByRole('button', { name: 'Editar livro' }).click()
    const link = 'https://capas.example.test/caderno.png'
    await page.route(link, (route) => route.fulfill({ contentType: 'image/png', body: image }))
    await dialog.getByLabel('Link da capa').fill(link)
    await expect(dialog.locator('.cover-preview img')).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(dialog.locator('.jr-head-art img')).toHaveAttribute('src', link)
    await dialog.getByRole('button', { name: 'Editar livro' }).click()
    await dialog.getByLabel('Enviar imagem').setInputFiles(file)
    await expect(dialog.getByText(/Capa preparada/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(dialog.locator('.jr-head-art img')).toBeVisible()
    await dialog.getByLabel('Situação na estante').selectOption('read')
    const slider = dialog.getByRole('slider')
    await slider.focus()
    await slider.press('End')
    await slider.press('ArrowLeft')
    await expect(slider).toHaveAttribute('aria-valuetext', '4,75 de 5 luas')
    await dialog.getByRole('button', { name: 'Salvar ficha' }).click()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    const saved = page.getByRole('button', { name: /Abrir Caderno do mar, Outra autoria/ })
    await expect(saved.locator('img')).toBeVisible()
    await expect(saved.locator('img')).toHaveAttribute(
      'src',
      scope === 'conta privada' ? /^blob:/ : /^data:image\/jpeg;/,
    )
    await page.getByRole('navigation', {name:'Navegação no celular'}).getByRole('button', { name: 'Histórico', exact: true }).click()
    await page.getByLabel('Avaliação', { exact: true }).selectOption('4.75')
    const historyBook = page.getByRole('button', { name: /Caderno do mar/ })
    await expect(historyBook.locator('img')).toBeVisible()
    await expect(historyBook.getByLabel('4,75 de 5 luas')).toBeVisible()
    await expect(historyBook.locator('.jr-luna').last().locator('svg').last()).toHaveCSS(
      'clip-path',
      'inset(0px 25% 0px 0px)',
    )
    await historyBook.click()
    await dialog.getByRole('button', { name: 'Excluir livro' }).click()
    await dialog.getByRole('button', { name: 'Cancelar' }).click()
    await expect(dialog.getByRole('heading', { name: 'Caderno do mar' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Excluir livro' }).click()
    await dialog.getByRole('button', { name: 'Excluir definitivamente' }).click()
    await expect(dialog).toHaveCount(0)
    await page.reload()
    await expect(page.getByText(/^[0-9]+ livros? na estante/)).toBeVisible()
    await expect(saved).toHaveCount(0)
  })
}
