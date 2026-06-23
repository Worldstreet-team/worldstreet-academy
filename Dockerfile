# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

# libc6-compat lets native modules (e.g. sharp, used by next/image) load on Alpine/musl
RUN apk add --no-cache libc6-compat

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g pnpm@10.32.0 && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Run
FROM node:22-alpine AS runner
WORKDIR /app

# libc6-compat: sharp's native binary (next/image optimizer)
# ca-certificates: HTTPS fetch of remote thumbnail sources by the optimizer
RUN apk add --no-cache libc6-compat ca-certificates

# Copy only necessary files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# next.config.ts is read at RUNTIME by `next start` (loaded via jiti, bundled with next).
# Without it, next/image loses its remotePatterns and rejects every remote thumbnail
# with `"url" parameter is not allowed`. Also needed for redirects/headers/etc.
COPY --from=builder /app/next.config.ts ./
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN npm install -g pnpm@10.32.0 && pnpm install --prod --frozen-lockfile

EXPOSE 3000
CMD ["pnpm", "start"]
