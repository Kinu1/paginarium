# Paginarium

Diário de leitura em português para organizar livros pelas capas. Cada pessoa tem uma estante privada, acessível no computador e no celular. Uma releitura guarda datas, formato, nota e resenha próprios e conta uma única vez no total de obras do ano.

[Abrir o Paginarium](https://paginarium-kinu1.web.app). Explore a estante de demonstração ou entre para buscar edições e salvar suas leituras em uma conta privada.

![Demonstração do Paginarium. Busca de uma edição, inclusão na estante e avaliação com quatro luas e meia.](docs/demonstracao.gif)

A demonstração usa livros, autorias e resenhas fictícios. As ilustrações das capas vêm do acervo aberto do Cleveland Museum of Art. [Créditos das capas](web/public/capas/creditos.txt) · [Estante no celular](docs/estante-mobile.png)

## Executar com Docker

Com Docker Desktop ou Docker Engine e Compose instalados, execute na raiz do repositório:

```sh
docker compose up -d --build --wait
```

Abra [o Paginarium local](http://localhost:5173). A primeira tela contém a estante de demonstração. Use **Entrar na minha conta** para criar uma conta de teste ou simular a entrada com Google. O emulador oficial permite experimentar o fluxo sem cadastrar serviços na nuvem. Links locais de verificação e recuperação por e-mail aparecem em `docker compose logs auth`.

O Compose inicia quatro serviços. O site e a API usam as portas locais 5173 e 3000, a autenticação usa 9099, e o PostgreSQL permanece na rede interna. Os volumes guardam livros e contas entre inicializações. Para encerrar, use `docker compose down`. Para desenvolver com atualização dos fontes, use `docker compose watch`.

## O que dá para fazer

- Buscar por título, autor ou ISBN na Open Library, consultar outras edições e cadastrar manualmente um livro com capa opcional.
- Organizar por status e tags, montar a lista do ano e registrar os dias em que realmente houve leitura.
- Editar título, autoria e capa pela ficha, acompanhar o progresso em páginas ou percentual e retomar uma leitura abandonada.
- Escrever resenhas com rascunho local, avaliar em passos de 0,25 lua, favoritar e iniciar releituras. Uma conclusão antiga pode registrar apenas mês e ano.
- Explorar o histórico por período, formato, tags, nota e favoritos. No calendário, cada dia de atividade mostra os livros lidos.
- Preencher bingo, desafios de A a Z e arco-íris, escolher favoritos mensais e comparar as capas nas rodadas do favorito anual.
- Sortear uma competição com 22 livros da estante e votar nas capas até escolher um campeão.
- Criar desafios nos cinco formatos, publicar suas regras e copiar modelos da comunidade. Cada pessoa preenche a própria cópia com os livros da sua estante.

## Como as partes se conectam

O frontend React, Vite e TypeScript usa Tailwind CSS e componentes shadcn/ui. A conta real é autenticada pelo Firebase. A interface envia o token à API própria em NestJS, que identifica o leitor e persiste o diário via Prisma em PostgreSQL. Alterações simultâneas usam controle de revisão. Os dados da demonstração e os rascunhos locais ficam no navegador. [Contratos da interface](shared/contracts.d.ts)

## Verificações

Com Node.js 24 e a pilha Docker em execução:

```sh
npm ci
npm --prefix api ci
npm --prefix web ci
npm run build
npm --prefix api test
node --test web/src/diario/diario.test.mjs web/src/annual/annual.test.mjs
npx playwright install chromium
npm run test:browser
node infra/testar-restauracao.mjs
```

Os testes de navegador usam contas fictícias no emulador. O teste de restauração aplica a migração real em um PostgreSQL descartável, restaura duas fichas e confere seus dados. Os workflows do GitHub repetem verificações de API, interface e integração em Linux.

## Beta e hospedagem

O beta foi projetado para Firebase Hosting e Authentication no plano Spark, Neon Free e Render Free. A execução local usa apenas Docker. O roteiro de validação orienta o teste com dez livros e registra dificuldades com edições e capas. [Publicação do beta](docs/hospedagem.md) · [Roteiro com leitores](docs/beta.md)

## Fluxo de contribuição

A `main` reúne as entregas integradas. Cada mudança tem branch própria e entra por pull request. Commits e PRs são escritos em português do Brasil, com o escopo da mudança e as verificações realizadas.
