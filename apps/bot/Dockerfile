FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

# Self-host mode: long-polls Telegram and runs the epoch report and liquidation warnings on an
# in-process cron (src/index.ts). Runs on ECS next to the private RDS database it stores links in.
CMD ["npx", "tsx", "src/index.ts"]
