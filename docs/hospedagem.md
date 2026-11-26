# Publicação do beta

O site estático usa Firebase Hosting no plano Spark. A API usa a imagem de `api/Dockerfile` no Render Free, com PostgreSQL no Neon Free. As contas e projetos de produção são separados do Firebase Auth Emulator e do banco do Compose.

1. Crie ou selecione o projeto Firebase e mantenha o faturamento desativado. No console, registre um aplicativo Web. Em Authentication, habilite e-mail/senha e Google, indique o e-mail de suporte e confira o domínio autorizado do Hosting.
2. No Neon Free, crie o PostgreSQL do Paginarium. Copie a URL de conexão PostgreSQL com TLS diretamente para a configuração protegida do Render. Trate-a como senha.
3. No Render, crie um Blueprint a partir deste repositório usando `render.yaml`. Confira o plano Free antes da confirmação. Defina `DATABASE_URL`, `FIREBASE_PROJECT_ID` e `WEB_ORIGIN` (origem HTTPS exata do site, por exemplo `https://SEU-PROJETO.web.app`). O contêiner aplica as migrações antes de iniciar o NestJS. Confira `https://SUA-API.onrender.com/api/health`.
4. Em `web/.env.production.local`, configure os quatro valores públicos do aplicativo Web conforme `web/.env.example` e `VITE_API_URL=https://SUA-API.onrender.com/api`. A URL do emulador é exclusiva do desenvolvimento local.
5. Na raiz do repositório, instale as dependências com `npm ci` e `npm --prefix web ci`. Execute `npm --prefix web run build` e `npx firebase deploy --only hosting --project SEU-PROJETO`. O Hosting publica a pasta `web/dist`.
6. Antes de convidar leitores, faça cadastro, recuperação por e-mail, login Google e inclusão de um livro em duas contas. Abra a mesma estante em outro aparelho. Teste a latência após inatividade e revise as cotas nos painéis. O Render Free pode demorar cerca de um minuto para despertar.

A criação e recuperação das contas reais depende dos provedores configurados no projeto Firebase. Os dados da demonstração ficam no navegador. Mantenha os backups reais em armazenamento privado e verifique a restauração em ambiente isolado antes de usá-los.

[Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart) · [Planos do Firebase](https://firebase.google.com/pricing) · [Plano Free do Neon](https://neon.com/pricing) · [Limites do Render Free](https://render.com/docs/free)
