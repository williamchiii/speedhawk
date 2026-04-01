FROM node:22-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y chromium && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/chromium

CMD ["npm", "run", "dev"]