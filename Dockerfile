FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate && npm run build
RUN useradd --system --uid 10001 assetflow && chown -R assetflow:assetflow /app
USER assetflow
ENV HOST=0.0.0.0 PORT=3001
EXPOSE 3001
CMD ["node", "apps/api/dist/server.js"]
