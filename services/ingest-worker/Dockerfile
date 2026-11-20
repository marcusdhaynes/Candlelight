FROM node:22-alpine
WORKDIR /app
COPY services/ingest-worker/package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY services/ingest-worker/*.mjs ./
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","runner.mjs"]
