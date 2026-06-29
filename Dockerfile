FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY src ./src
COPY tsconfig.json ./
RUN pnpm build

FROM node:26-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY index.html styles.css script.js ./
COPY scripts ./scripts
EXPOSE 3000
CMD ["node", "dist/server.js"]
