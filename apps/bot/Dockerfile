FROM node:24-alpine

WORKDIR /app

# RDS serves a certificate signed by Amazon's own CA, which Node doesn't trust by default. Without
# this every database call fails with SELF_SIGNED_CERT_IN_CHAIN. NODE_EXTRA_CA_CERTS adds to the
# normal trust store rather than replacing it, so certificate checking stays on.
RUN wget -q -O /rds-ca-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
ENV NODE_EXTRA_CA_CERTS=/rds-ca-bundle.pem

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

# Self-host mode: long-polls Telegram and runs the epoch report and liquidation warnings on an
# in-process cron (src/index.ts). Runs on ECS next to the private RDS database it stores links in.
CMD ["npx", "tsx", "src/index.ts"]
