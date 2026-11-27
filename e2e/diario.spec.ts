import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const emulator = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-local';
const api = 'http://localhost:3000/api';
async function account(request:APIRequestContext) {
  const email = 'leitor-' + randomUUID() + '@example.test';
  const password = randomUUID();
  const response = await request.post(emulator, {data:{email,password,returnSecureToken:true}});
  expect(response.ok()).toBeTruthy();
  return {email,password,idToken:(await response.json()).idToken as string};
}
async function login(page:Page, user:{email:string;password:string}) {
  await page.goto('/');
  await page.getByRole('button',{name:'Entrar na minha conta',exact:true}).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('E-mail',{exact:true}).fill(user.email);
  await dialog.getByLabel('Senha',{exact:true}).fill(user.password);
  await dialog.getByRole('button',{name:'Entrar',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Gerenciar conta',exact:true})).toBeVisible();
}

test('salva no PostgreSQL, recupera o rascunho offline e sincroniza com um segundo aparelho',async({page,browser,request})=>{
  const user = await account(request);
  await login(page,user);
  await page.getByRole('button',{name:'Adicionar livro',exact:true}).click();
  await page.getByRole('button',{name:'Adicionar manualmente'}).click();
  await page.locator('#manual-title').fill('Um livro de teste');
  await page.locator('#manual-author').fill('Pessoa Leitora');
  await page.getByRole('button',{name:'Adicionar à estante'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Situação na estante').selectOption('read');
  await dialog.getByLabel('Sei apenas o mês e o ano').check();
  await dialog.getByLabel('Mês de conclusão').fill('2025-01');
  await dialog.getByRole('button',{name:'Dar nota zero'}).click();
  await expect(dialog.getByText('0 de 5 luas',{exact:true})).toBeVisible();
  await dialog.getByLabel('Minha resenha').fill('Texto preservado durante uma falha.');
  await page.route('**/api/books/*',route=>route.request().method()==='PUT'?route.abort():route.continue());
  await dialog.getByRole('button',{name:'Salvar ficha'}).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/books/*');
  await page.reload();
  await page.getByRole('button',{name:/Abrir Um livro de teste/}).click();
  await expect(dialog.getByLabel('Minha resenha')).toHaveValue('Texto preservado durante uma falha.');
  await dialog.getByRole('button',{name:'Salvar ficha'}).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button',{name:/Abrir Um livro de teste/}).click();
  await dialog.getByRole('button',{name:'Iniciar releitura'}).click();
  await dialog.getByLabel('Data de início').fill('2025-10-01');
  await dialog.getByLabel('Formato da leitura').selectOption('audio');
  await dialog.getByLabel('Situação na estante').selectOption('read');
  await dialog.getByLabel('Data de conclusão').fill('2025-10-20');
  const slider=dialog.getByRole('slider');
  await slider.focus(); await slider.press('End'); await slider.press('ArrowLeft');
  await expect(slider).toHaveAttribute('aria-valuetext','4,75 de 5 luas');
  await dialog.getByLabel('Minha resenha').fill('Ouvi o livro pela segunda vez.');
  await dialog.getByRole('button',{name:'Salvar ficha'}).click();
  await expect(dialog).toHaveCount(0);
  const phone = await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR'});
  try {
    const mobile = await phone.newPage();
    await login(mobile,user);
    await mobile.getByRole('navigation',{name:'Navegação no celular'}).getByRole('button',{name:'Histórico',exact:true}).click();
    await mobile.getByLabel('Ano',{exact:true}).selectOption('2025');
    await expect(mobile.getByRole('heading',{name:'1 livro lido'})).toBeVisible();
    await expect(mobile.getByText('2 leituras no período')).toBeVisible();
    await mobile.getByLabel('Mês',{exact:true}).selectOption('01');
    await expect(mobile.getByLabel('0 de 5 luas',{exact:true})).toBeVisible();
    await mobile.getByLabel('Mês',{exact:true}).selectOption('10');
    await expect(mobile.getByLabel('4,75 de 5 luas',{exact:true})).toBeVisible();
  } finally {await phone.close();}
  const other = await account(request);
  const list=await request.get(api+'/books',{headers:{Authorization:'Bearer '+other.idToken}});
  expect(await list.json()).toEqual([]);
});

test('vincula uma capa ao bingo e preserva o progresso após recarregar',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Desafios',exact:true}).click();
  await page.getByRole('button',{name:'Autoria brasileira',exact:true}).click();
  await page.getByLabel('Vincular um livro da estante').selectOption({label:'O atlas das marés'});
  await expect(page.getByRole('button',{name:/Autoria brasileira.*O atlas das marés/})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Desafios',exact:true}).click();
  await expect(page.getByRole('button',{name:/Autoria brasileira.*O atlas das marés/})).toBeVisible();
});
