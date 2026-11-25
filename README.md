# Paginarium

Diário de leitura pessoal para quem quer organizar a estante pelas capas e guardar a história de cada leitura. A proposta é permitir que uma pessoa encontre um livro, marque os dias em que leu e registre uma resenha e uma nota de até cinco luas, inclusive meias-luas.

## O que está planejado

- Buscar por título, autoria ou ISBN e escolher uma edição pela capa.
- Organizar a estante com os estados **Quero ler**, **Lendo**, **Relendo** e **Lido**, além de tags pessoais.
- Manter uma ficha por leitura, com formato, calendário, resenha e avaliação. Uma releitura ganha uma nova ficha na mesma estante.
- Consultar os livros lidos por mês ou ano e acompanhar favoritos e desafios literários.
- Acessar a estante no computador e no celular usando a mesma conta, com e-mail e senha ou Google.

## Tecnologias previstas

| Camada | Escolha |
| --- | --- |
| Interface | React, TypeScript, Vite, Tailwind CSS e shadcn/ui |
| API própria | NestJS e Prisma |
| Banco de dados | PostgreSQL no Neon |
| Autenticação | Firebase Authentication |
| Catálogo de livros | Open Library |
| Hospedagem | Firebase Hosting para o site e Render para a API, nos planos gratuitos |

## Organização do repositório

A `main` reúne as entregas integradas. Cada mudança é desenvolvida em uma branch de escopo definido, como `funcionalidade/estante` ou `correcao/filtro-por-mes`, e integrada por pull request. Os commits e PRs são escritos em português do Brasil. Cada commit descreve uma mudança, e cada PR explica o que foi entregue e como foi verificado.
