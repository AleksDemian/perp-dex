# ── Stage 1: install deps + build ─────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --no-fund

COPY . .

ARG NEXT_PUBLIC_PERP_ADDRESS
ARG NEXT_PUBLIC_USDC_ADDRESS
ARG NEXT_PUBLIC_PRICE_FEED_ADDRESS
ARG NEXT_PUBLIC_CHAIN_ID=11155111
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_MARKET_SYMBOL=BTC-USD

ENV NEXT_PUBLIC_PERP_ADDRESS=$NEXT_PUBLIC_PERP_ADDRESS
ENV NEXT_PUBLIC_USDC_ADDRESS=$NEXT_PUBLIC_USDC_ADDRESS
ENV NEXT_PUBLIC_PRICE_FEED_ADDRESS=$NEXT_PUBLIC_PRICE_FEED_ADDRESS
ENV NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
ENV NEXT_PUBLIC_MARKET_SYMBOL=$NEXT_PUBLIC_MARKET_SYMBOL

RUN npm run build

# ── Stage 2: production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libstdc++
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
