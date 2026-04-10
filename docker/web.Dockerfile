FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

# Ignore the host lockfile here so npm can resolve the correct platform-specific
# Rollup optional dependency for the Linux container build environment.
RUN npm install --include=optional --package-lock=false

COPY . .
RUN npm --workspace @ai3d/web run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g serve

COPY --from=build /app/apps/web/dist ./dist

EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173"]

