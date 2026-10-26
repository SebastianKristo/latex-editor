# Kobling-server: Node 22 + TeX Live + smbclient. Bygges fra repo-roten.
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /src
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @kobling/web build \
 && pnpm --filter @kobling/server deploy --legacy --prod /out

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      texlive-latex-extra texlive-pictures texlive-science texlive-lang-european latexmk \
      samba-client zstd tar ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build /out /app
COPY --from=build /src/apps/web/dist /app/web
ENV KOBLING_DATA=/data KOBLING_WEB_DIR=/app/web KOBLING_PORT=8080 NODE_ENV=production
VOLUME /data
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://127.0.0.1:${KOBLING_PORT}/api/health || exit 1
CMD ["node", "src/index.js"]
