FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-fund && mkdir -p /dados && chown -R node:node /app /dados
COPY infra/firebase-emulator.json ./firebase.json
USER node
ENV CI=true
EXPOSE 9099
CMD ["sh", "-c", "set -- node_modules/.bin/firebase emulators:start --only auth --project demo-paginarium --export-on-exit=/dados/snapshot; if [ -f /dados/snapshot/firebase-export-metadata.json ]; then set -- \"$@\" --import=/dados/snapshot; fi; exec \"$@\""]
