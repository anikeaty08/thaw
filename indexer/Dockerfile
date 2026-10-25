FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

EXPOSE 42069
# Ponder refuses to reuse a schema written by a different build, so each deploy sets its own
# DATABASE_SCHEMA (see deploy-indexer.yml) and re-syncs from START_BLOCK. "thaw" is the fallback.
ENV DATABASE_SCHEMA=thaw
CMD ["npx", "ponder", "start", "--port", "42069", "--hostname", "0.0.0.0"]
