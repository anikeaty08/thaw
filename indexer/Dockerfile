FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

EXPOSE 42069
CMD ["npx", "ponder", "start", "--schema", "thaw", "--port", "42069", "--hostname", "0.0.0.0"]
