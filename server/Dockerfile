FROM node:18-bullseye AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
# Use npm install in the build image so Docker build succeeds even if lockfile and package.json
# are out-of-sync. This avoids failing the Cloud Build when package-lock.json is not updated.
# It will install devDeps needed for the TypeScript build.
RUN npm install --no-audit --no-fund --unsafe-perm

# Copy source and build
COPY . .
RUN npm run build

FROM node:18-bullseye AS runtime
WORKDIR /app

# Copy package files and install production dependencies
COPY --from=build /app/package*.json ./
RUN npm ci --only=production --no-audit --no-fund

# Copy built artifacts
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
# Cloud Run sets PORT to 8080 by default; expose 8080 to match
EXPOSE 8080
# Start the compiled entrypoint (06_app/main.js)
CMD ["node", "dist/06_app/main.js"]
