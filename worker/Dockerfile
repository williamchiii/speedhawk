FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*

# Build context is the repo root (see render.yaml dockerContext: ..)
COPY worker/package*.json ./
RUN npm install

COPY worker/ /app/

# Cert lives outside worker/; copy it where worker/src/config/database.js expects it
# (../../../shared/certs/global-bundle.pem resolves to /shared/certs from /app/src/config)
COPY shared/certs/ /shared/certs/

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium

CMD ["node", "src/worker.js"]
