# 🎄 Dijital Piyango - Yılbaşı Çekilişi 🎁

Modern, güvenli ve eğlenceli bir dijital çekiliş platformu. Türk Milli Piyango stilinde 5 toplu çekiliş sistemi ile gerçek zamanlı canlı yayın deneyimi.

## 🆕 Yeni: Comprehensive Refactoring (December 2024)

Bu proje kapsamlı bir refactoring geçirdi ve tamamen yenilendi!

**Önemli Gelişmeler**:
- 🎨 **Modern Design System**: Tutarlı UI/UX ve renk paleti
- 🔧 **Kritik Bug Düzeltmeleri**: Ticket purchase hatası, memory leaks, timer sorunları
- 🚀 **Performans İyileştirmeleri**: %25 daha az kod, optimize edilmiş re-render'lar
- 🎯 **Yeni Özellikler**: Bilet arama, sıralama, şanslı seçim, modern toast bildirimler
- 📦 **Component Architecture**: Daha küçük, yeniden kullanılabilir componentler
- 🔐 **Gelişmiş Güvenlik**: Granular Firestore rules, transaction-based operations

**📖 Detaylı bilgi için**: `/REFACTORING.md` dosyasına bakın.
**🔐 Güvenlik bilgisi için**: `/SECURITY.md` dosyasına bakın.

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

# Default admin email - bu email'e sahip kullanıcı DAIMA admin olur
VITE_ADMIN_EMAIL=admin@example.com
```

**ÖNEMLİ**: `VITE_ADMIN_EMAIL` ile belirlenen kullanıcı, Firestore'daki `isAdmin` flag'i `false` bile olsa admin yetkisine sahip olur. Bu güvenlik katmanı sağlar ve ilk kurulumu kolaylaştırır.

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

**🚨 CRITICAL: Firestore rules'ları deploy etmeniz gerekiyor!**

Proje kök dizininde `firestore.rules` dosyası bulunmaktadır. Bu kurallar kullanıcıların bilet satın alabilmesi için **zorunludur**.

**Deploy Komutu:**
```bash
# Firebase CLI kurulumu (eğer kurulu değilse)
npm install -g firebase-tools

# Firebase'e giriş yapın
firebase login

# Firestore rules'ları deploy edin
firebase deploy --only firestore:rules
```

**Veya Firebase Console'dan manuel olarak:**
1. [Firebase Console](https://console.firebase.google.com/) → Projeniz → Firestore Database
2. **Rules** sekmesine gidin
3. `firestore.rules` dosyasındaki kuralları kopyalayıp yapıştırın
4. **Publish** butonuna tıklayın

**Kuralların özeti:**
- ✅ Kullanıcılar sadece kendi biletlerini "requested" durumuna çekebilir
- ✅ Bilet numaraları ve lottery ID değiştirilemez
- ✅ Admin onayı olmadan bilet satışı tamamlanamaz
- ✅ Tüm admin işlemleri yetki kontrolünden geçer

Detaylı güvenlik bilgisi için `/SECURITY.md` dosyasına bakın.

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
│   ├── admin/
│   │   ├── AdminPanel.tsx          # Admin panel orchestrator
│   │   ├── AdminPanel.css          # Design system styling
│   │   └── CreateLotteryForm.tsx   # Lottery creation form (NEW)
│   ├── auth/                       # Giriş ve kayıt bileşenleri
│   ├── common/
│   │   ├── Button.tsx              # Unified button component (NEW)
│   │   ├── Button.css              # Button styles (NEW)
│   │   ├── Card.tsx                # Card component system (NEW)
│   │   ├── Card.css                # Card styles (NEW)
│   │   ├── Toast.tsx               # Toast notifications (NEW)
│   │   ├── Toast.css               # Toast styles (NEW)
│   │   ├── LoadingScreen.tsx       # Centralized loading (NEW)
│   │   ├── RulesModal.tsx          # Reusable rules modal (NEW)
│   │   ├── RulesModal.css          # Modal styles (NEW)
│   │   └── ...                     # Navigation, Ticket, Christmas Effects
│   ├── lottery/                    # Çekiliş bileşenleri
│   └── user/
│       ├── UserHome.tsx            # Redesigned with design system
│       ├── UserHome.css            # Modern CSS with variables
│       ├── BuyTicket.tsx           # Enhanced with search & filters
│       └── BuyTicket.css           # Modern CSS with variables
├── config/                         # Firebase yapılandırması
├── contexts/
│   ├── AuthContext.tsx
│   └── ToastContext.tsx            # Toast notification context (NEW)
├── hooks/
│   └── usePresenceTracking.ts      # Custom presence hook (NEW)
├── styles/
│   ├── variables.css               # Design system variables (NEW)
│   └── animations.css              # Reusable animations (NEW)
├── types/                          # TypeScript tip tanımlamaları
├── utils/                          # Yardımcı fonksiyonlar
│   ├── validation.ts               # Input doğrulama ve güvenlik
│   ├── secureOperations.ts         # Güvenli database işlemleri
│   └── defaultRules.ts             # Varsayılan kurallar
└── assets/                         # Statik dosyalar

/ (root)
├── firestore.rules                 # Firestore security rules (NEW - CRITICAL)
├── SECURITY.md                     # Security documentation (NEW)
├── REFACTORING.md                  # Refactoring documentation (NEW)
└── README.md                       # This file (UPDATED)
```

## 🔒 Güvenlik Özellikleri

- **Rate Limiting**: Dakikada 5 bilet talebi limiti
- **Transaction Safety**: Aynı biletin iki kişiye satılması engellenir
- **Input Validation**: Tüm kullanıcı girdileri doğrulanır ve temizlenir
- **XSS Protection**: HTML tag'leri filtrelenir
- **Admin Guards**: Admin işlemleri yetki kontrolünden geçer
- **HTTPS Only**: Production'da sadece HTTPS kabul edilir

## 🎨 Özelleştirme

### Design System Variables (Kolay Özelleştirme!)
Tüm renkler, spacing, font boyutları merkezi olarak `src/styles/variables.css` dosyasında tanımlıdır:

```css
:root {
  /* Ana Renkler - Buradan tüm uygulama renkleri değişir! */
  --color-primary: #667eea;        /* Ana mor renk */
  --color-secondary: #764ba2;      /* İkincil mor */
  --color-accent: #f093fb;         /* Vurgu rengi */

  /* Spacing - Tüm boşluklar */
  --spacing-md: 16px;              /* Standart boşluk */
  --spacing-lg: 24px;              /* Büyük boşluk */

  /* Typography - Font boyutları */
  --font-size-base: 1rem;          /* Temel font boyutu */
  --font-size-lg: 1.125rem;        /* Büyük font */

  /* ... ve 150+ değişken daha! */
}
```

**Tüm uygulama bu değişkenleri kullanır**, yani sadece bir yerde değişiklik yaparak tüm uygulamanın görünümünü değiştirebilirsiniz!

### Animasyonlar
`src/styles/animations.css` dosyasında 15+ hazır animasyon bulunur:
- fadeIn, slideInUp, scaleIn
- bounce, pulse, shimmer
- ve daha fazlası!

### Component Özelleştirme
- **Button**: 7 farklı variant (primary, secondary, success, error, warning, ghost, outline)
- **Card**: Padding ve hover efektleri özelleştirilebilir
- **Toast**: Renk ve pozisyon ayarlanabilir

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

### ⚠️ SPA Routing Desteği

Bu uygulama **Single Page Application (SPA)** olarak çalışır. Statik hosting platformlarında
direkt URL'lere (örn: `/admin`, `/lottery`) erişim sağlamak için yönlendirme (rewrite) kuralları gereklidir.

**Dahil Edilen Dosyalar:**
- `vercel.json` - Vercel için rewrite kuralları ✅ (otomatik çalışır)
- `public/_redirects` - Netlify için yönlendirme kuralları ✅ (otomatik çalışır)
- `render.yaml` - Render için konfigürasyon (Static Sites'te otomatik çalışmaz)

**📝 Routing Nasıl Çalışır:**
Tüm route'lar (`/admin`, `/lottery`, vb.) `/index.html`'e yönlendirilir → React Router client-side'da doğru sayfayı gösterir.

### Vercel ✅ (En Kolay)

1. Vercel hesabınıza giriş yapın
2. Projeyi import edin
3. Environment variables ekleyin (Firebase config)
4. Deploy!

**Not**: `vercel.json` dosyası proje içinde mevcut, routing otomatik çalışır! 🎉

### Render (Static Site)

**🚨 ÖNEMLİ: SPA Routing İçin Zorunlu Ayarlar**

Render Dashboard'da projenizi oluşturduktan sonra:

1. **Settings** → **Redirects/Rewrites** bölümüne gidin
2. **Add Rewrite Rule** butonuna tıklayın
3. Aşağıdaki kuralı ekleyin:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`

**Temel Ayarlar:**
1. **Type**: Static Site
2. **Build Command**: `npm install && npm run build`
3. **Publish Directory**: `dist`
4. **Auto-Deploy**: Yes
5. Environment variables:
   ```
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_domain
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

**Not**: `render.yaml` ve `public/_redirects` dosyaları dahil edilmiştir ancak
Render Static Sites bunları otomatik okumaz. Manuel olarak Rewrite Rule eklemeniz gerekir.

### Netlify ✅ (Kolay)

1. Netlify'a GitHub repo'nuzu bağlayın
2. **Build Command**: `npm run build`
3. **Publish Directory**: `dist`
4. Environment variables ekleyin (Firebase config)

**Not**: `public/_redirects` dosyası otomatik algılanır, routing çalışır! 🎉

## 🔧 Deployment Sorun Giderme

### Problem: Sayfayı yenilediğimde 404 hatası alıyorum

**Çözüm (Render için):**
1. Render Dashboard → Your Service → **Settings**
2. **Redirects/Rewrites** sekmesine git
3. **Add Rule** butonuna tıkla
4. Şu ayarları gir:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: **Rewrite** (redirect değil!)
5. Save değişiklikleri

**Çözüm (Vercel/Netlify için):**
Bu platformlarda `vercel.json` ve `_redirects` otomatik çalışır. Sorun yaşıyorsanız:
- Build loglarını kontrol edin
- `dist/_redirects` dosyasının build'de oluştuğunu doğrulayın

### Problem: Bilet görselleri (ticket images) 404 hatası veriyor

**Çözüm:**
Projeyi yeniden build edin:
```bash
npm run build
```

`dist/` klasöründe `ticket_2_5.png` dosyasının olduğunu kontrol edin.
Eğer yoksa, `public/ticket_2_5.png` dosyasının var olduğundan emin olun.

### Problem: Firebase bağlantısı çalışmıyor

**Çözüm:**
Environment variables'ın doğru ayarlandığından emin olun:
- Tüm `VITE_` prefix'li değişkenler mevcut olmalı
- Değerlerde tırnak işareti **olmamalı**
- Deploy sonrası servis yeniden başlatılmalı

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
