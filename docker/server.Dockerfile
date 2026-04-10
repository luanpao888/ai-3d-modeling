FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci --omit=dev --workspace @ai3d/server --workspace @ai3d/shared

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared

RUN mkdir -p /app/data/projects

EXPOSE 3000
CMD ["npm", "--workspace", "@ai3d/server", "run", "start"]

