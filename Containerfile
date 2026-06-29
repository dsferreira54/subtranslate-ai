FROM docker.io/library/node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN npm ci

COPY shared/ shared/
COPY backend/ backend/
COPY frontend/ frontend/

RUN npm run build

FROM docker.io/library/node:22-alpine AS runtime

RUN apk add --no-cache dumb-init \
  && addgroup -S subtranslate \
  && adduser -S subtranslate -G subtranslate

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/public

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/

RUN npm ci --omit=dev --ignore-scripts \
  && npm cache clean --force \
  && chown -R subtranslate:subtranslate /app

COPY --from=builder --chown=subtranslate:subtranslate /app/shared/dist ./shared/dist
COPY --from=builder --chown=subtranslate:subtranslate /app/backend/dist ./backend/dist
COPY --from=builder --chown=subtranslate:subtranslate /app/frontend/dist ./public

USER subtranslate

EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/server.js"]
