FROM node:20-slim

# Chromium system dependencies required by puppeteer on Debian slim
RUN apt-get update && apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  wget \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend production dependencies
# (puppeteer downloads its bundled Chromium here)
COPY package*.json ./
RUN npm install --omit=dev

# Install frontend dependencies and build static assets
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Remove frontend node_modules — only the built dist/ is needed at runtime
RUN rm -rf frontend/node_modules

# Copy server source
COPY core/ ./core/
COPY api/ ./api/
COPY plugins/ ./plugins/
COPY config/ ./config/
COPY .env.example ./

ENV NODE_ENV=production
ENV PORT=3000
# SESSION_PATH must match the Railway volume mount point
ENV SESSION_PATH=/data/session

EXPOSE 3000

CMD ["node", "core/server.js"]
