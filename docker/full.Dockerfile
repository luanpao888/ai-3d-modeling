FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Ignore the host lockfile here so npm can resolve the correct platform-specific
# Rollup optional dependency for the Linux container build environment.
RUN npm install --include=optional --package-lock=false

COPY . .
RUN npm --workspace @ai3d/web run build

FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev --workspace @ai3d/server --workspace @ai3d/shared

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /app/data/projects

EXPOSE 3000 4173
CMD ["sh", "-c", "node apps/server/src/index.js & serve -s apps/web/dist -l 4173"]
