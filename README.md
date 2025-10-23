# 🏭 İmalat Takip Sistemi - Backend

## 📋 Genel Bakış
Modern PostgreSQL tabanlı backend API servisi. Render.com'da deploy edilmiştir.

## 🚀 Render.com Deployment

### 1. PostgreSQL Database Oluşturma
1. Render.com'da "New PostgreSQL" seçin
2. Database adı: `imalattakip-db`
3. Plan: Free (1GB storage)
4. Region: Oregon (US West)

### 2. Web Service Oluşturma
1. Render.com'da "New Web Service" seçin
2. GitHub repository'nizi bağlayın
3. Ayarlar:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
   - **Region**: Oregon (US West)

### 3. Environment Variables
```bash
DATABASE_URL=postgresql://username:password@host:port/database
JWT_SECRET=imalattakip-secret-key-2024-render
NODE_ENV=production
```

### 4. Database Connection
PostgreSQL otomatik olarak bağlanır ve tabloları oluşturur.

## 📁 Klasör Yapısı
```
imalattakip-backend/
├── server.js              # Ana sunucu dosyası
├── package.json           # Proje bağımlılıkları
├── database/
│   ├── postgresql.js     # PostgreSQL bağlantısı
│   └── init.js           # SQLite (eski)
├── routes/
│   ├── auth.js           # Kimlik doğrulama
│   ├── transfers.js      # Transfer işlemleri
│   ├── units.js         # Birim yönetimi
│   ├── reports.js       # Raporlar
│   ├── externalVault.js # Dış kasa işlemleri
│   ├── users.js         # Kullanıcı yönetimi
│   ├── cinsi.js         # Cinsi ayarları
│   ├── companies.js     # Firma yönetimi
│   ├── logs.js          # Sistem logları
│   └── dashboardSettings.js # Dashboard ayarları
├── config/              # Konfigürasyon dosyaları
├── logs/               # Log dosyaları
├── render.yaml         # Render.com konfigürasyonu
└── deploy.sh           # Deploy script
```

## 🔧 API Endpoints

### Kimlik Doğrulama
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Giriş
- `GET /api/auth/verify` - Token doğrulama

### Transferler
- `GET /api/transfers` - Tüm transferler
- `POST /api/transfers` - Yeni transfer
- `PUT /api/transfers/:id` - Transfer güncelleme
- `DELETE /api/transfers/:id` - Transfer silme

### Birimler
- `GET /api/units/stats` - Birim istatistikleri
- `GET /api/units/:unitId/transfers` - Birim transferleri

### Raporlar
- `GET /api/reports` - Kapsamlı raporlar

### Dış Kasa
- `GET /api/external-vault/transactions` - Dış kasa işlemleri
- `GET /api/external-vault/stock` - Dış kasa stoku
- `POST /api/external-vault/transactions` - Yeni işlem
- `POST /api/external-vault/stock/sync` - Stok senkronizasyonu

### Kullanıcılar (Admin)
- `GET /api/users` - Kullanıcı listesi
- `PUT /api/users/:id/role` - Rol güncelleme
- `DELETE /api/users/:id` - Kullanıcı silme

### Cinsi Ayarları
- `GET /api/cinsi` - Cinsi listesi
- `POST /api/cinsi` - Yeni cinsi
- `PUT /api/cinsi/:id` - Cinsi güncelleme
- `DELETE /api/cinsi/:id` - Cinsi silme
- `POST /api/cinsi/reset` - Varsayılanlara sıfırla

### Firmalar
- `GET /api/companies` - Firma listesi
- `POST /api/companies` - Yeni firma
- `PUT /api/companies/:id` - Firma güncelleme
- `DELETE /api/companies/:id` - Firma silme

### Sistem Logları
- `GET /api/logs` - Log listesi
- `POST /api/logs` - Yeni log
- `DELETE /api/logs/:id` - Log silme
- `DELETE /api/logs/clear` - Tüm logları temizle

### Dashboard Ayarları
- `GET /api/dashboard-settings` - Dashboard ayarları
- `POST /api/dashboard-settings` - Ayarları kaydet
- `POST /api/dashboard-settings/reset` - Ayarları sıfırla

## 🔒 Güvenlik
- JWT token tabanlı kimlik doğrulama
- Rate limiting (15 dakikada 1000 istek)
- Helmet.js güvenlik middleware
- CORS koruması
- Şifre hashleme (bcrypt)
- SQL injection koruması

## 📊 Veritabanı
- PostgreSQL veritabanı kullanılır
- Connection pooling
- Otomatik tablo oluşturma
- Foreign key ilişkileri
- Database indexing
- Sistem logları

## 🌐 Sunucu Bilgileri
- **Port**: Render.com otomatik ayarlar
- **Health Check**: `https://your-app.onrender.com/api/health`
- **Konum**: Render.com cloud
- **SSL**: Otomatik SSL sertifikası

## 📝 Loglar
- Winston logger kullanılır
- Render.com log viewer
- Console çıktısı
- Error tracking

## 🔄 Otomatik Yedekleme
Render.com PostgreSQL:
- ✅ Otomatik backup
- ✅ Point-in-time recovery
- ✅ High availability
- ✅ SSL encryption

## 🚨 Önemli Notlar
- İlk çalıştırmada admin kullanıcısı oluşturun
- Environment variables Render.com'da ayarlayın
- PostgreSQL connection string gerekli
- Graceful shutdown desteklenir

## 🛠️ Local Development
```bash
# Dependencies yükle
npm install

# PostgreSQL bağlantısı için .env dosyası oluştur
cp env.example .env

# .env dosyasını düzenle
DATABASE_URL=postgresql://localhost:5432/imalattakip

# Uygulamayı başlat
npm start

# Geliştirme modunda çalıştır (nodemon)
npm run dev
```

## 📞 Destek
Herhangi bir sorun için Render.com log viewer'ı kontrol edin.