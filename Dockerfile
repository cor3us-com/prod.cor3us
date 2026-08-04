# Cor3us Ready — Production Container
# Node.js 20 slim — sıfır npm bağımlılığı

FROM node:20-slim

WORKDIR /app

# Proje dosyalarını kopyala
COPY . .

# Gereksiz dosyaları temizle (build sırasında)
RUN rm -f tools/migrate-budget-csv.mjs

# Port
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Sağlık kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/status', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "tools/server.mjs"]
