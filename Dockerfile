# Kobling-server: Node 22 + TeX Live + smbclient. Bygges fra repo-roten.
ARG RUNTIME=debian:trixie-slim
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY . .
# Valgfri hemmelighet «ca»: ekstra rot-sertifikat bak en TLS-inspiserende proxy.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
 && corepack enable && pnpm install --frozen-lockfile && pnpm --filter @kobling/web build \
 && pnpm --filter @kobling/server deploy --legacy --prod /out

# Debian 13 (trixie) har TeX Live 2024. RUNTIME kan overstyres (f.eks. ubuntu:24.04) der Debian-speilene ikke er tilgjengelige.
FROM ${RUNTIME}
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      texlive-latex-extra texlive-pictures texlive-science texlive-lang-european latexmk dvisvgm \
      smbclient zstd tar ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=build /out /app
COPY --from=build /src/apps/web/dist /app/web
ENV KOBLING_DATA=/data KOBLING_WEB_DIR=/app/web KOBLING_LISTEN_PORT=8080 KOBLING_INSTALL=docker NODE_ENV=production
VOLUME /data
EXPOSE 8080 8443
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "src/index.js"]
