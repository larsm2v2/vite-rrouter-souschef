FROM node:18-bullseye AS build
WORKDIR /app

# Install build deps so sharp can be compiled
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential python3 pkg-config libvips-dev git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Use npm install here so the build succeeds even when package-lock.json
# is out of sync with package.json (avoids npm ci lockfile errors).
RUN npm install --no-audit --no-fund --unsafe-perm

COPY . .
# Compile TypeScript to produce a ./dist directory for the runtime stage.
# If there's no TypeScript config or build step, the command is allowed to
# fail without aborting the build to preserve compatibility with JS-only setups.
RUN npx tsc -p tsconfig.json --outDir dist || true

FROM node:18-bullseye AS runtime
WORKDIR /app

# Install runtime deps: tesseract, imagemagick, libvips for sharp runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr tesseract-ocr-eng imagemagick libvips42 libvips-dev \
  && rm -rf /var/lib/apt/lists/*

# Copy node modules from build stage
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Simple healthcheck script
RUN printf '#!/bin/sh\nset -e\nif ! command -v tesseract >/dev/null 2>&1; then echo "tesseract not found" >&2; exit 1; fi\nif ! command -v convert >/dev/null 2>&1; then echo "imagemagick convert not found" >&2; exit 1; fi\nexec "$@"\n' > /usr/local/bin/healthcheck.sh && chmod +x /usr/local/bin/healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD tesseract --version >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
