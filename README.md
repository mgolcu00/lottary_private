# 🎄 Dijital Piyango - Yılbaşı Çekilişi 🎁

Modern, güvenli ve eğlenceli bir dijital çekiliş platformu. Türk Milli Piyango stilinde 5 toplu çekiliş sistemi ile gerçek zamanlı canlı yayın deneyimi.

## ✨ Özellikler

### 🎟️ Çekiliş Sistemi
- **Akıllı Algoritma**: Her numara çekilişinde mutlaka eşleşen bilet kontrolü yapılır
- **5 Top Sistemi**: Türk Milli Piyango tarzı 5 farklı tüpten çekiliş
- **Amorti Sistemi**: 2 ayrı amorti çekilişi (1-5 ve 5-9 arası)
- **Canlı Yayın**: Gerçek zamanlı animasyonlar ve efektler
- **Şeffaf Süreç**: Tüm çekiliş süreci canlı olarak izlenilebilir

### 🎅 Yılbaşı Teması
- Kar taneleri animasyonu
- Noel süsleri ve dekorasyonlar
- Renkli ışık efektleri
- Yeşil tema ile sonuç ekranı

### 🔐 Güvenlik
- Email OTP ve Google Authentication
- Rate limiting (spam koruması)
- Transaction-based bilet satışı (race condition koruması)
- Input validation ve sanitization
- XSS koruması
- Admin yetkilendirme sistemi

### 👥 Kullanıcı Sistemi
- 18+ yaş onayı
- Şartlar ve koşullar kabulü
- Kullanıcı profili ve bilet geçmişi
- Gerçek zamanlı bilet durumu takibi

### 👨‍💼 Admin Paneli
- Çekiliş oluşturma ve yönetimi
- Bilet isteklerini onaylama/reddetme
- Kullanıcı yönetimi
- Canlı çekiliş kontrolü
- İstatistikler ve raporlama

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- npm veya yarn
- Firebase projesi

### Adımlar

1. **Projeyi klonlayın**:
```bash
git clone <repo-url>
cd lottary
```

2. **Bağımlılıkları yükleyin**:
```bash
npm install
```

3. **Environment değişkenlerini ayarlayın**:
```bash
cp .env.example .env
```

`.env` dosyasını Firebase bilgilerinizle güncelleyin:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

4. **Geliştirme sunucusunu başlatın**:
```bash
npm run dev
```

5. **Production build**:
```bash
npm run build
```

## 🔧 Firebase Yapılandırması

### 1. Proje Oluşturma
1. [Firebase Console](https://console.firebase.google.com/)'a gidin
2. Yeni proje oluşturun
3. Web uygulaması ekleyin

### 2. Authentication Ayarları
- **Email/Password**: Aktif edin
- **Google**: OAuth client ID ekleyin
- **Email Link Authentication**: Aktif edin

### 3. Firestore Database
Production modda başlatın ve aşağıdaki koleksiyonlar otomatik oluşturulacaktır:
- `users` - Kullanıcı bilgileri
- `lotteries` - Çekiliş ayarları
- `tickets` - Biletler
- `ticketRequests` - Bilet talepleri
- `lotterySessions` - Canlı çekiliş oturumları

### 4. Firestore Rules (Önemli!)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Lotteries collection
    match /lotteries/{lotteryId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Tickets collection
    match /tickets/{ticketId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Ticket requests
    match /ticketRequests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }

    // Lottery sessions
    match /lotterySessions/{sessionId} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## 👤 Admin Kullanıcı Oluşturma

Firestore Console'da `users` koleksiyonunda bir kullanıcının `isAdmin` alanını `true` yapın:

```javascript
{
  uid: "user-firebase-uid",
  email: "admin@example.com",
  displayName: "Admin Name",
  isAdmin: true,
  termsAccepted: true,
  isOver18: true
}
```

## 📖 Kullanım Kılavuzu

### 👥 Kullanıcı İşlemleri

1. **Giriş Yapma**
   - Email ile giriş (OTP link alınır)
   - Google hesabı ile giriş

2. **İlk Giriş**
   - İsim belirleme
   - 18+ yaş onayı
   - Şartlar ve koşulları kabul etme

3. **Bilet Alma**
   - Ana sayfada "Bilet Al" butonuna tıklayın
   - Mevcut biletler arasından seçim yapın
   - Talep gönderin ve admin onayını bekleyin

4. **Çekiliş İzleme**
   - Çekiliş başladığında otomatik bildirim alırsınız
   - "Canlı İzle" butonuna tıklayarak çekilişi izleyin
   - Çekiliş tamamlandığında sonuçları görüntüleyin

### 👨‍💼 Admin İşlemleri

1. **Çekiliş Oluşturma**
   - `/admin` sayfasına gidin
   - "Yeni Çekiliş Oluştur" butonuna tıklayın
   - Gerekli bilgileri doldurun:
     - Çekiliş adı
     - Bilet fiyatı
     - Büyük ödül tutarı
     - Amorti ödülü
     - Toplam bilet sayısı
     - Çekiliş tarihi

2. **Bilet Yönetimi**
   - "İstekler" sekmesinden gelen talepleri görün
   - Talepleri onaylayın veya reddedin
   - Onaylanan biletler kullanıcıya atanır

3. **Çekiliş Başlatma**
   - Çekiliş sayfasına gidin (`/lottery?lotteryId=...`)
   - "Çekilişi Başlat" butonuna tıklayın
   - Sırayla numaraları çekin:
     - Amorti #1 (1-5 arası)
     - Amorti #2 (5-9 arası)
     - Büyük ödül için 5 numara (1-9 arası)

## 🎯 Akıllı Çekiliş Algoritması

Sistemin en önemli özelliği, her numara çekilişinde mutlaka en az bir bilet ile eşleşme olmasını sağlayan akıllı algoritmadır:

1. **İlk Numara**: En az 1 bilette 1. pozisyonda bu sayı olmalı
2. **İkinci Numara**: En az 1 bilette ilk 2 pozisyon eşleşmeli
3. **Üçüncü Numara**: En az 1 bilette ilk 3 pozisyon eşleşmeli
4. **Dördüncü ve Beşinci**: Aynı mantıkla devam eder

Bu sayede çekiliş sonunda mutlaka bir kazanan çıkar veya pot devredilir.

## 🏗️ Proje Yapısı

```
src/
├── components/
│   ├── admin/           # Admin paneli bileşenleri
│   ├── auth/            # Giriş ve kayıt bileşenleri
│   ├── common/          # Ortak bileşenler (Navigation, Ticket, Christmas Effects)
│   ├── lottery/         # Çekiliş bileşenleri
│   └── user/            # Kullanıcı bileşenleri
├── config/              # Firebase yapılandırması
├── contexts/            # React Context'leri
├── types/               # TypeScript tip tanımlamaları
├── utils/               # Yardımcı fonksiyonlar
│   ├── validation.ts    # Input doğrulama ve güvenlik
│   ├── secureOperations.ts # Güvenli database işlemleri
│   └── defaultRules.ts  # Varsayılan kurallar ve sorumluluk reddi
└── assets/              # Statik dosyalar (logo, görseller)
```

## 🔒 Güvenlik Özellikleri

- **Rate Limiting**: Dakikada 5 bilet talebi limiti
- **Transaction Safety**: Aynı biletin iki kişiye satılması engellenir
- **Input Validation**: Tüm kullanıcı girdileri doğrulanır ve temizlenir
- **XSS Protection**: HTML tag'leri filtrelenir
- **Admin Guards**: Admin işlemleri yetki kontrolünden geçer
- **HTTPS Only**: Production'da sadece HTTPS kabul edilir

## 🎨 Özelleştirme

### Renkler ve Tema
CSS dosyalarında renkleri değiştirebilirsiniz:
- `src/components/lottery/LotterySession.css` - Çekiliş ekranı renkleri
- `src/components/user/UserHome.css` - Ana sayfa renkleri

### Varsayılan Kurallar
`src/utils/defaultRules.ts` dosyasında kuralları ve sorumluluk reddi metnini düzenleyebilirsiniz.

### Logo
`/public/raw_icon.svg` ve `src/assets/raw_logo.png` dosyalarını kendi logonuzla değiştirin.

## 📱 Responsive Tasarım

Uygulama tüm ekran boyutlarında çalışır:
- 📱 Mobile (320px+)
- 📱 Tablet (640px+)
- 💻 Desktop (1024px+)

## 🚀 Deploy

### Vercel

1. Vercel hesabınıza giriş yapın
2. Projeyi import edin
3. Environment variables ekleyin
4. Deploy!

### Render

1. `package.json` içinde `engines` belirtin
2. Build command: `npm run build`
3. Start command: `npm run preview`

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing`)
5. Pull Request açın

## 📝 Lisans

MIT License - detaylar için `LICENSE` dosyasına bakın.

## 🎄 Mutlu Yıllar! 🎁

Bu proje şirket içi yılbaşı eğlencesi için geliştirilmiştir. Herkesin adil ve şeffaf bir şekilde çekilişe katılmasını sağlamak için tasarlanmıştır.

**Lütfen sorumlu bir şekilde kullanın!** 🙏
