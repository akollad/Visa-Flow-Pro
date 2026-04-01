FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app

RUN npm install -g pnpm@10

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY .npmrc ./
COPY tsconfig.base.json ./
COPY tsconfig.json ./

COPY artifacts/slot-hunter/package.json ./artifacts/slot-hunter/package.json

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN pnpm install --frozen-lockfile --filter @workspace/slot-hunter

# Install exact Chromium version matching the installed playwright package
RUN cd artifacts/slot-hunter && npx playwright install chromium

COPY artifacts/slot-hunter ./artifacts/slot-hunter

CMD ["pnpm", "--filter", "@workspace/slot-hunter", "run", "start"]
