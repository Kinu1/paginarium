FROM node:24-bookworm-slim AS dependencias
WORKDIR /app/api
# O mecanismo de migrações do Prisma precisa do OpenSSL da distribuição.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY api/package.json api/package-lock.json ./
RUN npm ci --include=dev --no-fund

FROM dependencias AS compilacao
COPY api/prisma ./prisma
COPY api/prisma.config.ts api/tsconfig.json ./
COPY api/src ./src
RUN npm run build

FROM dependencias AS execucao
ENV NODE_ENV=production
COPY --from=compilacao /app/api/dist ./dist
COPY --from=compilacao /app/api/prisma ./prisma
COPY --from=compilacao /app/api/prisma.config.ts ./
USER node
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && exec node dist/main.js"]
