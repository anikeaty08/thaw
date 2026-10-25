FROM node:24-alpine

WORKDIR /app

# The Telegram-linking endpoint talks to RDS directly, and RDS certificates are signed by Amazon's own
# CA, which Node doesn't trust by default. This adds it to the trust store (checking stays on).
RUN wget -q -O /rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/rds-ca-bundle.pem

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

EXPOSE 42069
# Ponder refuses to reuse a schema written by a different build, so each deploy sets its own
# DATABASE_SCHEMA (see deploy-indexer.yml) and re-syncs from START_BLOCK. "thaw" is the fallback.
ENV DATABASE_SCHEMA=thaw
CMD ["npx", "ponder", "start", "--port", "42069", "--hostname", "0.0.0.0"]
