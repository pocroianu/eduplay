# Build from the repository root:
# docker build -f edu-play-core/Dockerfile -t eduplay .
FROM node:24.12.0-alpine AS builder
WORKDIR /repo
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm ci

# Next.js embeds NEXT_PUBLIC_* values during the build.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build:platform

FROM node:24.12.0-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat wget \
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=builder --chown=nextjs:nodejs /repo/edu-play-core/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/edu-play-core/public ./edu-play-core/public
COPY --from=builder --chown=nextjs:nodejs /repo/edu-play-core/.next/static ./edu-play-core/.next/static
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "edu-play-core/server.js"]
