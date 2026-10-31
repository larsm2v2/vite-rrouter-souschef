FROM node:24-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# Install runtime deps: tesseract, imagemagick, libvips for sharp runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
  tesseract-ocr tesseract-ocr-eng imagemagick libvips42 \
  && rm -rf /var/lib/apt/lists/*

# Install only runtime dependencies in the final image.
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Simple healthcheck script
RUN printf '#!/bin/sh\nset -e\nif ! command -v tesseract >/dev/null 2>&1; then echo "tesseract not found" >&2; exit 1; fi\nif ! command -v convert >/dev/null 2>&1; then echo "imagemagick convert not found" >&2; exit 1; fi\nexec "$@"\n' > /usr/local/bin/healthcheck.sh && chmod +x /usr/local/bin/healthcheck.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD tesseract --version >/dev/null 2>&1 || exit 1

CMD ["node", "dist/index.js"]
