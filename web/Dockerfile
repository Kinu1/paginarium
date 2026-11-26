FROM node:24-bookworm-slim
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --include=dev --no-fund
COPY --chown=node:node shared /app/shared
COPY --chown=node:node web ./
RUN chown node:node /app/web/node_modules /app/web
USER node
EXPOSE 5173
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
