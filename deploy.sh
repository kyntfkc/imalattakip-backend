#!/bin/bash

# Render.com Deploy Script
# Bu script Render.com'da otomatik olarak çalışır

echo "🚀 İmalat Takip Backend Deploy Başlıyor..."

# Node.js ve npm versiyonlarını kontrol et
echo "📋 Node.js Version: $(node --version)"
echo "📋 NPM Version: $(npm --version)"

# Dependencies yükle
echo "📦 Dependencies yükleniyor..."
npm install

# PostgreSQL bağlantısını test et
echo "🔍 PostgreSQL bağlantısı test ediliyor..."
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable bulunamadı!"
  exit 1
fi

echo "✅ DATABASE_URL bulundu"

# Uygulamayı başlat
echo "🎯 Uygulama başlatılıyor..."
npm start
