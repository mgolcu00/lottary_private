# Yılbaşı Çekilişi 🎟️

Şirket içi yılbaşı çekilişi için geliştirilmiş modern web uygulaması.

## Özellikler

- ✨ Email (OTP) ve Google ile giriş
- 🎫 Bilet satın alma ve yönetimi
- ⏱️ Gerçek zamanlı geri sayım
- 🎊 Canlı çekiliş animasyonları
- 👨‍💼 Admin paneli
- 🔥 Firebase real-time güncellemeler
- 📱 Responsive tasarım

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. `.env` dosyası oluşturun:
```bash
cp .env.example .env
```

3. Firebase ayarlarınızı `.env` dosyasına ekleyin

4. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

## Firebase Yapılandırması

1. [Firebase Console](https://console.firebase.google.com/) üzerinden yeni bir proje oluşturun
2. Authentication'ı aktif edin (Email/Password ve Google)
3. Firestore Database oluşturun
4. Web uygulaması ekleyin ve config bilgilerini `.env` dosyasına ekleyin

## Admin Kullanıcı Oluşturma

Firestore'da bir kullanıcının `isAdmin` alanını `true` yapın:

```javascript
// Firestore Console'da users koleksiyonunda
{
  uid: "user-id",
  email: "admin@example.com",
  displayName: "Admin",
  isAdmin: true  // Bu alanı ekleyin
}
```

## Kullanım

### Kullanıcı Tarafı
1. Email veya Google ile giriş yapın
2. Ana sayfada çekilişe kalan süreyi görün
3. "Bilet Al" butonuna tıklayın
4. İstediğiniz bileti seçin
5. Admin onayını bekleyin
6. Çekiliş zamanında canlı yayını izleyin

### Admin Tarafı
1. `/admin` sayfasına gidin
2. Çekiliş ayarlarını belirleyin
3. Bilet isteklerini onaylayın/reddedin
4. Çekiliş zamanında çekilişi başlatın

## Teknolojiler

- React 18
- TypeScript
- Vite
- Firebase (Auth + Firestore)
- React Router DOM
- CSS Modules

## Lisans

MIT
